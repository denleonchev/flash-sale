import { trace } from "@opentelemetry/api";
import type { LoggerOptions } from "pino";
import type { ResourceDetector } from "@opentelemetry/resources";
import type { SpanExporter } from "@opentelemetry/sdk-trace-base";

export const TELEMETRY_BACKENDS = {
  NONE: "none",
  CONSOLE: "console",
  GCP: "gcp",
} as const;

export type TelemetryBackend = (typeof TELEMETRY_BACKENDS)[keyof typeof TELEMETRY_BACKENDS];

export const LOG_FORMATS = {
  PLAIN: "plain",
  GCP: "gcp",
} as const;

export type LogFormat = (typeof LOG_FORMATS)[keyof typeof LOG_FORMATS];

const GCP_SEVERITY_BY_LEVEL: Record<string, string> = {
  trace: "DEBUG",
  debug: "DEBUG",
  info: "INFO",
  warn: "WARNING",
  error: "ERROR",
  fatal: "CRITICAL",
};

function resolveBackend(): TelemetryBackend {
  const raw = process.env["TELEMETRY_BACKEND"];
  return Object.values(TELEMETRY_BACKENDS).includes(raw as TelemetryBackend)
    ? (raw as TelemetryBackend)
    : TELEMETRY_BACKENDS.NONE;
}

/**
 * Vendor adapters are loaded by name at runtime, never imported statically: an app that
 * does not depend on the adapter must still build and run (that is the whole point of
 * the split). A missing adapter degrades to no tracing, it does not crash the service.
 */
async function loadGcpAdapter(): Promise<typeof import("@flash-sale/telemetry-gcp") | null> {
  try {
    return await import("@flash-sale/telemetry-gcp");
  } catch {
    process.stderr.write("TELEMETRY_BACKEND=gcp but @flash-sale/telemetry-gcp is absent\n");
    return null;
  }
}

export async function loadTraceExporter(): Promise<SpanExporter | undefined> {
  switch (resolveBackend()) {
    case TELEMETRY_BACKENDS.CONSOLE: {
      const { ConsoleSpanExporter } = await import("@opentelemetry/sdk-trace-base");
      return new ConsoleSpanExporter();
    }
    case TELEMETRY_BACKENDS.GCP:
      return (await loadGcpAdapter())?.createTraceExporter();
    default:
      return undefined;
  }
}

export async function loadResourceDetectors(): Promise<ResourceDetector[]> {
  if (resolveBackend() !== TELEMETRY_BACKENDS.GCP) return [];
  return (await loadGcpAdapter())?.listResourceDetectors() ?? [];
}

export async function startNodeTracing(serviceName: string): Promise<void> {
  const [{ NodeSDK }, { NoopSpanProcessor }] = await Promise.all([
    import("@opentelemetry/sdk-node"),
    import("@opentelemetry/sdk-trace-base"),
  ]);
  const [{ HttpInstrumentation }, { IORedisInstrumentation }, { NestInstrumentation }] =
    await Promise.all([
      import("@opentelemetry/instrumentation-http"),
      import("@opentelemetry/instrumentation-ioredis"),
      import("@opentelemetry/instrumentation-nestjs-core"),
    ]);

  const traceExporter = await loadTraceExporter();

  new NodeSDK({
    serviceName,
    ...(traceExporter ? { traceExporter } : { spanProcessors: [new NoopSpanProcessor()] }),
    resourceDetectors: await loadResourceDetectors(),
    instrumentations: [
      new HttpInstrumentation(),
      new IORedisInstrumentation(),
      new NestInstrumentation(),
    ],
  }).start();
}

/**
 * Logs go to stdout and nowhere else — the platform collects them (Ops Agent on GCP,
 * the awslogs driver on AWS). LOG_FORMAT only renames fields into the shape the
 * collector understands; it pulls in no vendor code.
 */
export function buildLoggerOptions(serviceName: string): LoggerOptions {
  const format =
    process.env["LOG_FORMAT"] === LOG_FORMATS.GCP ? LOG_FORMATS.GCP : LOG_FORMATS.PLAIN;
  const projectId = process.env["GCP_PROJECT_ID"];
  const asGcp = format === LOG_FORMATS.GCP;

  return {
    base: { service: serviceName },
    ...(asGcp
      ? {
          formatters: {
            level: (label: string) => ({ severity: GCP_SEVERITY_BY_LEVEL[label] ?? "DEFAULT" }),
          },
        }
      : {}),
    mixin() {
      const spanContext = trace.getActiveSpan()?.spanContext();
      if (!spanContext) return {};
      return asGcp && projectId
        ? {
            "logging.googleapis.com/trace": `projects/${projectId}/traces/${spanContext.traceId}`,
            "logging.googleapis.com/spanId": spanContext.spanId,
          }
        : { traceId: spanContext.traceId, spanId: spanContext.spanId };
    },
  };
}
