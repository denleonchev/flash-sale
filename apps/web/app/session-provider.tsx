"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  SessionSummaryResponseSchema,
  type SessionSummary,
} from "@/lib/schemas/session-summary.schema";

type SessionContextValue = {
  session: SessionSummary | null;
  isLoading: boolean;
  refreshSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

async function fetchSessionSummary(): Promise<SessionSummary | null> {
  const res = await fetch("/api/me", { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch session: ${res.status}`);
  return SessionSummaryResponseSchema.parse(await res.json()).session;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const pathname = usePathname();

  const refreshSession = useCallback(async () => {
    try {
      setSession(await fetchSessionSummary());
    } catch {
      setSession(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSession();
  }, [pathname, refreshSession]);

  return (
    <SessionContext.Provider value={{ session, isLoading, refreshSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error("useSession must be used inside SessionProvider");
  return value;
}
