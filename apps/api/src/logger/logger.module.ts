import { Module } from "@nestjs/common";
import { fileURLToPath } from "node:url";
import { LoggerModule } from "nestjs-pino";
import { createGcpLoggingPinoConfig } from "@google-cloud/pino-logging-gcp-config";

const projectId = process.env["GCP_PROJECT_ID"];
const gcpTransportPath = fileURLToPath(new URL("./gcp-log-transport.js", import.meta.url));

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        ...createGcpLoggingPinoConfig(),
        transport: {
          targets: [
            ...(projectId
              ? [{ target: gcpTransportPath, options: { projectId, serviceName: "api" } }]
              : []),
            process.env["NODE_ENV"] === "production"
              ? { target: "pino/file", options: { destination: 1 } }
              : { target: "pino-pretty", options: { colorize: true } },
          ],
        },
      },
    }),
  ],
})
export class AppLoggerModule {}
