"use client";

import type { ClientErrorReport } from "./schemas/client-error-report.schema";

// sendBeacon survives page unload — the buyer often closes the tab right after a
// crash, before a normal fetch() would have finished. Fall back to keepalive fetch
// where sendBeacon isn't available.
export function reportClientError(report: ClientErrorReport): void {
  const body = JSON.stringify(report);
  if (typeof navigator.sendBeacon === "function") {
    navigator.sendBeacon("/api/client-errors", new Blob([body], { type: "application/json" }));
  } else {
    void fetch("/api/client-errors", { method: "POST", body, keepalive: true });
  }
}
