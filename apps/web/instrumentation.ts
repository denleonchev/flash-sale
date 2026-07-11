export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerNode } = await import("./instrumentation-node");
    await registerNode();
  }
}

export async function onRequestError(
  err: Error,
  request: { path: string; method: string },
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { logger } = await import("./lib/logger/logger.server");
  const { trace } = await import("@opentelemetry/api");
  trace.getActiveSpan()?.recordException(err);
  logger.error({ err, path: request.path }, err.message);
}
