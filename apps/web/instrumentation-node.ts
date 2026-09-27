import { format } from "node:util";
import { registerOTel } from "@vercel/otel";
import { NoopSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { loadTraceExporter } from "@flash-sale/telemetry";

export async function registerNode(): Promise<void> {
  // @vercel/otel does not inject traceparent into every outgoing fetch by default
  // (avoids leaking trace context to third parties like Stripe/Auth0/Groq) — api
  // must be allow-listed explicitly, or its spans start a disconnected trace.
  const instrumentationConfig = {
    fetch: {
      propagateContextUrls: [process.env["API_INTERNAL_URL"] ?? "http://localhost:3001"],
    },
  };

  const traceExporter = await loadTraceExporter();
  registerOTel({
    serviceName: "web",
    ...(traceExporter
      ? { traceExporter, autoDetectResources: true }
      : { spanProcessors: [new NoopSpanProcessor()], autoDetectResources: false }),
    instrumentationConfig,
  });

  const { logger } = await import("./lib/logger/logger.server");
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    const method = level === "log" ? "info" : level;
    console[level] = (...args: unknown[]) => logger[method](format(...args));
  }

  process.on("uncaughtException", (err) => {
    logger.fatal({ err }, "uncaughtException");
  });
  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "unhandledRejection");
  });
}
