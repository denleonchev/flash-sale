import type { RiskLevel } from "@flash-sale/shared";
import type { FraudEvalCase } from "./fraud-eval.cases.js";

const MIN_CORRECT = 9;

export interface CaseVerdict {
  evalCase: FraudEvalCase;
  actual: RiskLevel;
  reason: string;
}

export class FraudEvalResult {
  readonly passed: boolean;
  private readonly mismatches: CaseVerdict[];
  private readonly correct: number;

  constructor(private readonly verdicts: CaseVerdict[]) {
    this.mismatches = verdicts.filter((v) => v.actual !== v.evalCase.expected);
    this.correct = verdicts.length - this.mismatches.length;
    this.passed = this.correct >= MIN_CORRECT;
  }

  print(): void {
    console.log(`fraud eval: ${this.correct}/${this.verdicts.length} (threshold ${MIN_CORRECT})`);
    for (const { evalCase, actual, reason } of this.mismatches) {
      console.log(`  x ${evalCase.name}: expected=${evalCase.expected} got=${actual} — ${reason}`);
    }
    console.log(this.passed ? "PASS" : "FAIL");
  }
}
