import { Injectable, Logger } from "@nestjs/common";
import { RISK_LEVELS, type FraudScreeningJobPayload, type RiskLevel } from "@flash-sale/shared";
import { FraudFlagsRepository } from "./fraud-flags.repository.js";
import { GroqService, GroqRateLimitError } from "../ai/groq.service.js";
import { EmbeddingService } from "../embeds/embedding.service.js";

const SYSTEM_PROMPT = `You are a fraud detection AI for a flash-sale platform.
Analyze the buyer's behavior pattern and similar historical cases.
Respond ONLY with JSON: {"risk":"low"|"medium"|"high","reason":"..."}
HIGH risk: many attempts in short window, account < 24h old, mostly failed/sold_out.
MEDIUM risk: elevated attempts, young account, mixed outcomes.
LOW risk: few attempts, older account, confirmed orders.`;

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

    const similarContext = similar.length
      ? similar
          .map((f, i) => `${i + 1}. pattern: ${f.pattern} | risk: ${f.risk} | reason: ${f.reason}`)
          .join("\n")
      : "No historical precedents found.";

    const userMsg = `Current buyer pattern: ${pattern}\n\nSimilar historical cases:\n${similarContext}`;

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
