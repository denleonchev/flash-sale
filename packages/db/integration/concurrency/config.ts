/** Run parameters for the concurrency harness, read from env (NFR-8: names, not values). */
export interface HarnessConfig {
  readonly stock: number; // K — units available
  readonly buyers: number; // N — concurrent buyers (expected N > K)
  readonly apiUrl: string;
  readonly quantity: number; // units each buyer requests
}

export function loadHarnessConfig(): HarnessConfig {
  return {
    stock: Number(process.env["CONCURRENCY_STOCK"] ?? 5),
    buyers: Number(process.env["CONCURRENCY_BUYERS"] ?? 50),
    apiUrl: process.env["CONCURRENCY_API_URL"] ?? "http://localhost:3001",
    quantity: Number(process.env["CONCURRENCY_QUANTITY"] ?? 1),
  };
}
