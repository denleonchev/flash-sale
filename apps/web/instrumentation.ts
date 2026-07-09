import { registerOTel } from "@vercel/otel";

export async function register(): Promise<void> {
  const projectId = process.env["GCP_PROJECT_ID"];

  // Local dev has no GCP credentials — fall back to printing spans to the console instead
  // of wiring the Cloud Trace exporter, so tracing is verifiable without touching GCP.
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
