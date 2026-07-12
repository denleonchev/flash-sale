"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/report-client-error";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    reportClientError({
      kind: "global-error",
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      path: window.location.pathname,
    });
  }, [error]);

  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col items-center justify-center bg-zinc-950 text-zinc-50 antialiased py-20 text-center">
        <div className="max-w-md">
          <p className="text-red-500 text-xs font-semibold tracking-widest uppercase mb-4">Error</p>
          <h1 className="text-3xl font-bold text-zinc-50 mb-3">Something went wrong</h1>
          <p className="text-zinc-400 mb-8">
            {error.message || "An unexpected error occurred. Please try again."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="inline-block bg-red-600 hover:bg-red-500 text-white font-semibold px-6 py-3 rounded-md transition-colors"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
