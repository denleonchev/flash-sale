import { Injectable, Logger } from "@nestjs/common";
import { RISK_LEVELS, type FraudScreeningJobPayload, type RiskLevel } from "@flash-sale/shared";
import { FraudFlagsRepository } from "./fraud-flags.repository.js";
import { GroqService, GroqRateLimitError } from "../ai/groq.service.js";
import { EmbeddingService } from "../embeds/embedding.service.js";

const SYSTEM_PROMPT = `You are a fraud detection AI for a flash-sale platform.
Analyze the buyer's behavior pattern and similar historical cases.
Respond ONLY with JSON: {"risk":"low"|"medium"|"high","reason":"..."}
Use the calibration examples below as your threshold anchors — they define what counts as low/medium/high in this system.`;

// FR-22: static few-shot anchors define concrete thresholds so Groq is calibrated
// even on a cold-start DB. DB-retrieved similar cases are appended after these.
const FEW_SHOT_EXAMPLES = `Calibration examples (ground truth):
1. pattern: attempts: 1, confirmed: 1, sold_out: 0, failed: 0, time_window_minutes: 0, account_age_hours: 720 | risk: low | reason: single successful purchase, established account
2. pattern: attempts: 2, confirmed: 1, sold_out: 1, failed: 0, time_window_minutes: 3, account_age_hours: 168 | risk: low | reason: one retry after sold-out, week-old account, no red flags
3. pattern: attempts: 4, confirmed: 1, sold_out: 2, failed: 1, time_window_minutes: 8, account_age_hours: 36 | risk: medium | reason: four attempts in 8 minutes, young account, mixed outcomes
4. pattern: attempts: 6, confirmed: 2, sold_out: 3, failed: 1, time_window_minutes: 12, account_age_hours: 5 | risk: medium | reason: six attempts within 12 minutes, account under 6 hours old
5. pattern: attempts: 9, confirmed: 0, sold_out: 7, failed: 2, time_window_minutes: 6, account_age_hours: 1 | risk: high | reason: nine rapid attempts all failing, brand-new account, classic bot pattern
6. pattern: attempts: 15, confirmed: 1, sold_out: 10, failed: 4, time_window_minutes: 4, account_age_hours: 0 | risk: high | reason: 15 attempts in 4 minutes, account minutes old, overwhelmingly failed`;

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

    const pattern = [
      `attempts: ${activity.attempts}`,
      `confirmed: ${activity.confirmed}`,
      `sold_out: ${activity.sold_out}`,
      `failed: ${activity.failed}`,
      `time_window_minutes: ${activity.time_window_minutes}`,
      `account_age_hours: ${activity.account_age_hours}`,
    ].join(", ");

    const vector = await this.embeddingService.embed(pattern);
    const similar = await this.repo.findSimilarFlags(vector, 3);

    const historicalContext = similar.length
      ? "\n\nSimilar cases from this platform's history:\n" +
        similar.map((f, i) => `${i + 1}. pattern: ${f.pattern} | risk: ${f.risk} | reason: ${f.reason}`).join("\n")
      : "";

    const userMsg = `Current buyer pattern: ${pattern}\n\n${FEW_SHOT_EXAMPLES}${historicalContext}`;

    let risk: RiskLevel = RISK_LEVELS.LOW;
    let reason = "";

    try {
      const response = await this.groqService.chat([
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMsg },
      ]);
      const parsed = JSON.parse(response) as { risk?: string; reason?: string };
      const parsedRisk = parsed.risk;
      if (
        parsedRisk === RISK_LEVELS.LOW ||
        parsedRisk === RISK_LEVELS.MEDIUM ||
        parsedRisk === RISK_LEVELS.HIGH
      ) {
        risk = parsedRisk;
      } else {
        this.logger.warn(`Groq returned unexpected risk value: "${parsedRisk}", defaulting to low`);
      }
      reason = parsed.reason ?? "";
    } catch (err) {
      if (err instanceof GroqRateLimitError) throw err; // BullMQ retries with backoff
      // FR-27: fail-safe — any other Groq error must not block or surface to the buyer.
      this.logger.warn(`Fraud screening error for order ${orderId}: ${String(err)}, defaulting to low`);
    }

    if (risk === RISK_LEVELS.MEDIUM || risk === RISK_LEVELS.HIGH) {
      await this.repo.createFlag({ orderId, buyerId, saleId, risk, reason, pattern, embedding: vector });
    }
  }
}
