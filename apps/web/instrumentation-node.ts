import { format } from "node:util";
import { registerOTel } from "@vercel/otel";

export async function registerNode(): Promise<void> {
  const projectId = process.env["GCP_PROJECT_ID"];

  if (projectId) {
    const { TraceExporter } = await import("@google-cloud/opentelemetry-cloud-trace-exporter");
    registerOTel({ serviceName: "web", traceExporter: new TraceExporter({ projectId }) });
  } else {
    registerOTel({ serviceName: "web" });
  }

  const { logger } = await import("./lib/logger/logger.server");
  for (const level of ["log", "info", "warn", "error", "debug"] as const) {
    const method = level === "log" ? "info" : level;
    console[level] = (...args: unknown[]) => logger[method](format(...args));
  }
}
