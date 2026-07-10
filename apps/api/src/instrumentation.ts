import { NodeSDK, tracing } from "@opentelemetry/sdk-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core";
import { gcpDetector } from "@opentelemetry/resource-detector-gcp";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";

const projectId = process.env["GCP_PROJECT_ID"];

const sdk = new NodeSDK({
  serviceName: "api",
  traceExporter: projectId ? new TraceExporter({ projectId }) : new tracing.ConsoleSpanExporter(),
  resourceDetectors: [gcpDetector],
  instrumentations: [
    new HttpInstrumentation(),
    new IORedisInstrumentation(),
    new NestInstrumentation(),
  ],
});

sdk.start();
