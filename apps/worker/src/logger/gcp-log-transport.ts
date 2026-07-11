import build from "pino-abstract-transport";
import { Logging } from "@google-cloud/logging";

interface GcpLogTransportOptions {
  projectId: string;
  serviceName: string;
}

export default async function buildGcpLogTransport(opts: GcpLogTransportOptions) {
  const logging = new Logging({ projectId: opts.projectId });
  const log = logging.log(opts.serviceName);

  return build(async (source) => {
    for await (const line of source) {
      const { severity = "DEFAULT", ...jsonPayload } = line as Record<string, unknown> & {
        severity?: string;
      };
      await log.write(log.entry({ severity }, jsonPayload));
    }
  });
}
