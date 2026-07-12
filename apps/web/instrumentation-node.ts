import { format } from "node:util";
import { registerOTel } from "@vercel/otel";
import { ConsoleSpanExporter, NoopSpanProcessor } from "@opentelemetry/sdk-trace-base";

export async function registerNode(): Promise<void> {
  const projectId = process.env["GCP_PROJECT_ID"];
  const isTraceDebuggingEnabled = process.env["DEBUG_TRACES"] === "1";

  // @vercel/otel does not inject traceparent into every outgoing fetch by default
  // (avoids leaking trace context to third parties like Stripe/Auth0/Groq) — api
  // must be allow-listed explicitly, or its spans start a disconnected trace.
  const instrumentationConfig = {
    fetch: {
      propagateContextUrls: [process.env["API_INTERNAL_URL"] ?? "http://localhost:3001"],
    },
  };

  if (projectId) {
    const { TraceExporter } = await import("@google-cloud/opentelemetry-cloud-trace-exporter");
    registerOTel({
      serviceName: "web",
      traceExporter: new TraceExporter({ projectId }),
      autoDetectResources: true,
      instrumentationConfig,
    });
  } else {
    registerOTel({
      serviceName: "web",
      ...(isTraceDebuggingEnabled
        ? { traceExporter: new ConsoleSpanExporter() }
        : { spanProcessors: [new NoopSpanProcessor()] }),
      autoDetectResources: false,
      instrumentationConfig,
    });
  }

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
