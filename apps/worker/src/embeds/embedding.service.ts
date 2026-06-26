import { Injectable, Logger } from "@nestjs/common";

// Minimal type for the feature-extraction pipeline — avoids importing the full
// @xenova/transformers types at the module level (dynamic import below).
type Extractor = (
  text: string,
  opts: { pooling: string; normalize: boolean },
) => Promise<{ data: Float32Array }>;

@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private extractor: Extractor | null = null;

  // FR-26, NFR-14: lazy-load so the worker starts fast; model stays in memory after first call.
  async embed(text: string): Promise<number[]> {
    if (!this.extractor) {
      this.logger.log("loading all-MiniLM-L6-v2 (one-time, stays in memory)");
      const { pipeline } = await import("@xenova/transformers");
      this.extractor = (await pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
        quantized: true,
      })) as unknown as Extractor;
    }
    const output = await this.extractor(text, {
      pooling: "mean",
      normalize: true,
    });
    return Array.from(output.data);
  }
}
