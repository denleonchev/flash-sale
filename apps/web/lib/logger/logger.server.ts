import "server-only";
import { fileURLToPath } from "node:url";
import pino from "pino";
import { createGcpLoggingPinoConfig } from "@google-cloud/pino-logging-gcp-config";

const projectId = process.env["GCP_PROJECT_ID"];
const gcpTransportPath = fileURLToPath(new URL("./gcp-log-transport.js", import.meta.url));

export const logger = pino({
  ...createGcpLoggingPinoConfig(),
  transport: {
    targets: [
      ...(projectId
        ? [{ target: gcpTransportPath, options: { projectId, serviceName: "web" } }]
        : []),
      process.env["NODE_ENV"] === "production"
        ? { target: "pino/file", options: { destination: 1 } }
        : { target: "pino-pretty", options: { colorize: true } },
    ],
  },
});
