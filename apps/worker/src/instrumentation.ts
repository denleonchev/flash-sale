import { NodeSDK, tracing } from "@opentelemetry/sdk-node";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { IORedisInstrumentation } from "@opentelemetry/instrumentation-ioredis";
import { NestInstrumentation } from "@opentelemetry/instrumentation-nestjs-core";
import { gcpDetector } from "@opentelemetry/resource-detector-gcp";
import { TraceExporter } from "@google-cloud/opentelemetry-cloud-trace-exporter";

const projectId = process.env["GCP_PROJECT_ID"];
const isTraceDebuggingEnabled = process.env["DEBUG_TRACES"] === "1";

const tracingConfig = projectId
  ? { traceExporter: new TraceExporter({ projectId }) }
  : isTraceDebuggingEnabled
    ? { traceExporter: new tracing.ConsoleSpanExporter() }
    : { spanProcessors: [new tracing.NoopSpanProcessor()] };

const sdk = new NodeSDK({
  serviceName: "worker",
  ...tracingConfig,
  resourceDetectors: projectId ? [gcpDetector] : [],
  instrumentations: [
    new HttpInstrumentation(),
    new IORedisInstrumentation(),
    new NestInstrumentation(),
  ],
});

sdk.start();
