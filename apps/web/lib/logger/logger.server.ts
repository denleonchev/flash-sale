import "server-only";
import pino from "pino";
import { buildLoggerOptions } from "@flash-sale/telemetry";

export const logger = pino(buildLoggerOptions("web"));
