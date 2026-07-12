"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

export function ClientErrorListeners(): null {
  useEffect(() => {
    const onError = (event: ErrorEvent): void => {
      reportClientError({
        kind: "window-error",
        message: event.message,
        stack: event.error instanceof Error ? event.error.stack : undefined,
        path: window.location.pathname,
      });
    };
    const onRejection = (event: PromiseRejectionEvent): void => {
      const reason: unknown = event.reason;
      reportClientError({
        kind: "unhandled-rejection",
        message: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        path: window.location.pathname,
      });
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
