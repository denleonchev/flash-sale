import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";
import { gcpDetector } from "@opentelemetry/resource-detector-gcp";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";
import type { ResourceDetector } from "@opentelemetry/resources";

/**
 * The only place in the repo that imports a Google SDK. Apps depend on it explicitly,
 * so dropping that one dependency line keeps it out of the image entirely — the core
 * package reaches it through an optional peer dependency.
 */
export function createTraceExporter(): SpanExporter {
  const projectId = process.env["GCP_PROJECT_ID"];
  if (!projectId) throw new Error("GCP_PROJECT_ID is not set");
  return new TraceExporter({ projectId });
}

export function listResourceDetectors(): ResourceDetector[] {
  return [gcpDetector];
}
