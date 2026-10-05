/**
 * Fraud-screening eval — one number that says whether a prompt, few-shot or retrieval
 * change made screening better or worse. Entry point.
 *
 * Runs every labelled case through FraudScreeningService.assess(), the same path
 * production uses, and compares the verdict with the human-approved label.
 *
 * Run (human — boundaries.md: calls external Groq; needs a local Postgres):
 *   pnpm build && pnpm --filter @flash-sale/worker eval:fraud
 */
import { PrismaService } from "../../db/prisma.service.js";
import { GroqService } from "../../ai/groq.service.js";
import { EmbeddingService } from "../../embeds/embedding.service.js";
import { FraudFlagsRepository } from "../fraud-flags.repository.js";
import { FraudScreeningService } from "../fraud-screening.service.js";
import { ConfirmedFlagSeeder } from "./confirmed-flag-seeder.js";
import { FraudEvalRunner } from "./fraud-eval-runner.js";

const EXIT_CODES = { PASSED: 0, BELOW_THRESHOLD: 1, INVALID_RUN: 2 } as const;

async function main(): Promise<void> {
  const prisma = new PrismaService();
  const embeddingService = new EmbeddingService();
  const screeningService = new FraudScreeningService(
    new FraudFlagsRepository(prisma),
    new GroqService(),
    embeddingService,
  );
  const runner = new FraudEvalRunner(
    screeningService,
    new ConfirmedFlagSeeder(prisma, embeddingService),
  );

  try {
    const result = await runner.run();
    result.print();
    process.exitCode = result.passed ? EXIT_CODES.PASSED : EXIT_CODES.BELOW_THRESHOLD;
  } finally {
    await prisma.db.$disconnect();
  }
}

main().catch((err) => {
  console.error(`fraud eval: invalid run — ${String(err)}`);
  process.exitCode = EXIT_CODES.INVALID_RUN;
});
