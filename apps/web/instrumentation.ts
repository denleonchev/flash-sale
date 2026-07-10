import { registerOTel } from "@vercel/otel";

export async function register(): Promise<void> {
  const projectId = process.env["GCP_PROJECT_ID"];

  if (!projectId) {
    registerOTel({ serviceName: "web" });
    return;
  }

  const { TraceExporter } = await import("@google-cloud/opentelemetry-cloud-trace-exporter");
  registerOTel({
    serviceName: "web",
    traceExporter: new TraceExporter({ projectId }),
  });
}
