import { Injectable, Logger } from "@nestjs/common";
import { RISK_LEVELS, type FraudScreeningJobPayload, type RiskLevel } from "@flash-sale/shared";
import {
  FraudFlagsRepository,
  type BuyerActivity,
  type SimilarFlag,
} from "./fraud-flags.repository.js";
import { GroqService } from "../ai/groq.service.js";
import { EmbeddingService } from "../embeds/embedding.service.js";
import { FRAUD_SYSTEM_PROMPT, FRAUD_FEW_SHOT_EXAMPLES } from "./fraud-screening.prompts.js";

export interface FraudAssessment {
  risk: RiskLevel;
  reason: string;
  pattern: string;
  vector: number[] | undefined;
}

@Injectable()
export class FraudScreeningService {
  private readonly logger = new Logger(FraudScreeningService.name);

  constructor(
    private readonly repo: FraudFlagsRepository,
    private readonly groqService: GroqService,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async screen(payload: FraudScreeningJobPayload): Promise<void> {
    const { orderId, buyerId, saleId } = payload;
    const activity = await this.repo.getBuyerActivity(buyerId, 60);
    const { risk, reason, pattern, vector } = await this.assess(activity);

    this.logger.log(`fraud screen order ${orderId}: risk=${risk}`);
    // FR-22: every verdict is stored; the RAG lookup reads only the confirmed ones.
    await this.repo.createFlag({
      orderId,
      buyerId,
      saleId,
      risk,
      reason,
      pattern,
      embedding: vector ?? [],
    });
    this.logger.log(`fraud flag created for order ${orderId} risk=${risk}`);
  }

  async assess(activity: BuyerActivity): Promise<FraudAssessment> {
    const pattern = this.buildPattern(activity);
    const { vector, similar } = await this.fetchSimilar(pattern);
    const { risk, reason } = await this.classify(pattern, similar);
    return { risk, reason, pattern, vector };
  }

  private buildPattern(activity: BuyerActivity): string {
    return [
      `attempts: ${activity.attempts}`,
      `confirmed: ${activity.confirmed}`,
      `sold_out: ${activity.sold_out}`,
      `failed: ${activity.failed}`,
      `time_window_minutes: ${activity.time_window_minutes}`,
      `account_age_hours: ${activity.account_age_hours}`,
    ].join(", ");
  }

  private async fetchSimilar(pattern: string) {
    try {
      const vector = await this.embeddingService.embed(pattern);
      const similar = await this.repo.findSimilarFlags(vector, 3);
      return { vector, similar };
    } catch (err) {
      this.logger.warn(`Embedding unavailable, skipping similar-case lookup: ${String(err)}`);
      return { vector: undefined, similar: [] };
    }
  }

  private async classify(
    pattern: string,
    similar: SimilarFlag[],
  ): Promise<{ risk: RiskLevel; reason: string }> {
    const historicalContext = similar.length
      ? "\n\nSimilar cases from this platform's history, confirmed by a moderator:\n" +
        similar
          .map((f, i) => `${i + 1}. pattern: ${f.pattern} | risk: ${f.risk} | reason: ${f.reason}`)
          .join("\n")
      : "";

    const response = await this.groqService.chat([
      { role: "system", content: FRAUD_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Current buyer pattern: ${pattern}\n\n${FRAUD_FEW_SHOT_EXAMPLES}${historicalContext}`,
      },
    ]);
    const parsed = JSON.parse(response) as { risk?: string; reason?: string };
    const parsedRisk = parsed.risk;
    if (!(Object.values(RISK_LEVELS) as string[]).includes(parsedRisk ?? "")) {
      throw new Error(`Groq returned unexpected risk value: "${parsedRisk}"`);
    }
    return { risk: parsedRisk as RiskLevel, reason: parsed.reason ?? "" };
  }
}
