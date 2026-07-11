import { Module } from "@nestjs/common";
import { Writable } from "node:stream";
import { LoggerModule } from "nestjs-pino";
import { createGcpLoggingPinoConfig } from "@google-cloud/pino-logging-gcp-config";
import { Logging } from "@google-cloud/logging";

const projectId = process.env["GCP_PROJECT_ID"];
const gcpLog = projectId ? new Logging({ projectId }).log("api") : undefined;

// A `transport` worker thread can't take function `formatters` and can't see this
// thread's active OTel span (needed for the trace-id mixin) — synchronous stream instead.
const stream = new Writable({
  write(chunk: Buffer, _encoding, callback) {
    const line = chunk.toString();
    process.stdout.write(line);
    if (gcpLog) {
      const { severity = "DEFAULT", ...jsonPayload } = JSON.parse(line) as Record<
        string,
        unknown
      > & { severity?: string };
      gcpLog
        .write(gcpLog.entry({ severity }, jsonPayload))
        .catch((err: unknown) => process.stderr.write(`gcp log write failed: ${String(err)}\n`));
    }
    callback();
  },
});

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: [createGcpLoggingPinoConfig(), stream],
    }),
  ],
})
export class AppLoggerModule {}
