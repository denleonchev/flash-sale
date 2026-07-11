import "server-only";
import { Writable } from "node:stream";
import pino from "pino";
import { Logging } from "@google-cloud/logging";
import { createGcpLoggingPinoConfig } from "@google-cloud/pino-logging-gcp-config";

const projectId = process.env["GCP_PROJECT_ID"];
const gcpLog = projectId ? new Logging({ projectId }).log("web") : undefined;

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

export const logger = pino(createGcpLoggingPinoConfig(), stream);
