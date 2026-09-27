import { Module } from "@nestjs/common";
import { LoggerModule } from "nestjs-pino";
import { buildLoggerOptions } from "@flash-sale/telemetry";

@Module({
  imports: [LoggerModule.forRoot({ pinoHttp: buildLoggerOptions("worker") })],
})
export class AppLoggerModule {}
