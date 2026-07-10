import { context, propagation, trace } from "@opentelemetry/api";

const tracer = trace.getTracer("worker");

export function runWithJobTrace<T extends { traceparent?: string }>(
  jobName: string,
  data: T,
  fn: () => Promise<void>,
): Promise<void> {
  const parentContext = data.traceparent
    ? propagation.extract(context.active(), { traceparent: data.traceparent })
    : context.active();

  return context.with(parentContext, () =>
    tracer.startActiveSpan(`process ${jobName}`, async (span) => {
      try {
        await fn();
      } finally {
        span.end();
      }
    }),
  );
}
