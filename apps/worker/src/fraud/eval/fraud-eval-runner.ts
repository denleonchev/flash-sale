import type { FraudAssessment, FraudScreeningService } from "../fraud-screening.service.js";
import type { ConfirmedFlagSeeder } from "./confirmed-flag-seeder.js";
import { FRAUD_EVAL_CASES, type FraudEvalCase } from "./fraud-eval.cases.js";
import { FraudEvalResult, type CaseVerdict } from "./fraud-eval-result.js";

const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5_000;

export class InvalidRunError extends Error {}

export class FraudEvalRunner {
  constructor(
    private readonly screeningService: FraudScreeningService,
    private readonly seeder: ConfirmedFlagSeeder,
  ) {}

  async run(): Promise<FraudEvalResult> {
    await this.seeder.seedConfirmedFlags();
    try {
      return new FraudEvalResult(await this.assessAllCases());
    } finally {
      await this.seeder.removeSeededFlags();
    }
  }

  private async assessAllCases(): Promise<CaseVerdict[]> {
    const verdicts: CaseVerdict[] = [];
    // One at a time: Groq is rate-limited.
    for (const evalCase of FRAUD_EVAL_CASES) {
      const assessment = await this.assessWithRetry(evalCase);
      this.assertUsedRetrieval(evalCase, assessment);
      verdicts.push({ evalCase, actual: assessment.risk, reason: assessment.reason });
    }
    return verdicts;
  }

  private async assessWithRetry(evalCase: FraudEvalCase): Promise<FraudAssessment> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.screeningService.assess(evalCase.activity);
      } catch (err) {
        if (attempt === MAX_ATTEMPTS) {
          throw new InvalidRunError(`case "${evalCase.name}" got no verdict: ${String(err)}`);
        }
        await this.waitBeforeRetry(attempt);
      }
    }
  }

  private waitBeforeRetry(attempt: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
  }

  private assertUsedRetrieval(evalCase: FraudEvalCase, assessment: FraudAssessment): void {
    if (!assessment.vector) {
      throw new InvalidRunError(`case "${evalCase.name}" ran without retrieval (no embedding)`);
    }
  }
}
