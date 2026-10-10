"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { SESSION_ROLES } from "@/lib/schemas/session-summary.schema";
import { useSession } from "./session-provider";

export function SiteHeader() {
  const { session, isLoading } = useSession();
  const isAdmin = session?.role === SESSION_ROLES.ADMIN;
  const canReviewFraud = isAdmin || session?.role === SESSION_ROLES.MODERATOR;

  const logo = (
    <Link
      href="/"
      className="flex items-center gap-2 font-bold text-lg text-zinc-50 hover:text-red-400 transition-colors"
    >
      <Zap className="w-6 h-6 text-red-500 fill-red-500" />
      <span>FLASH SALE</span>
    </Link>
  );

  const navLinks = (
    <>
      <Link
        href="/sales"
        className="text-base text-zinc-400 hover:text-zinc-50 transition-colors sm:text-sm py-2 sm:py-0"
      >
        Catalog
      </Link>
      {canReviewFraud && (
        <Link
          href="/admin/fraud-flags"
          className="text-base text-zinc-400 hover:text-zinc-50 transition-colors sm:text-sm py-2 sm:py-0"
        >
          Fraud flags
        </Link>
      )}
    </>
  );

  const userRow = isLoading ? (
    <span role="status" aria-label="Loading account" className="flex h-8 items-center">
      <Spinner className="w-4 h-4" />
    </span>
  ) : session ? (
    <>
      <span className="text-zinc-50 font-medium truncate">{session.displayName}</span>
      {isAdmin ? (
        <span className="text-sm text-red-400">admin</span>
      ) : canReviewFraud ? (
        <span className="text-sm text-zinc-500">moderator</span>
      ) : (
        <span className="text-sm text-zinc-500">buyer</span>
      )}
      <a
        href={session.isDemo ? "/api/demo/logout" : "/auth/logout"}
        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-2 sm:py-0"
      >
        Sign out
      </a>
    </>
  ) : (
    <a
      href="/auth/login"
      className="bg-red-600 hover:bg-red-500 text-white text-sm font-medium px-3 py-1.5 rounded-md transition-colors"
    >
      Sign in
    </a>
  );

  return (
    <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
      <div className="max-w-5xl mx-auto px-4">
        {/* ── Mobile (< sm): 3 rows ── */}
        <div className="sm:hidden py-4 flex flex-col gap-3">
          <div className="flex justify-center py-1">{logo}</div>
          <nav className="flex items-center justify-center gap-6">{navLinks}</nav>
          <div className="flex items-center justify-center gap-4">{userRow}</div>
        </div>

        {/* ── Desktop (sm+): single row ── */}
        <div className="hidden sm:flex h-14 items-center justify-between gap-6 text-sm">
          <div className="flex items-center gap-6">
            {logo}
            <nav className="flex items-center gap-4">{navLinks}</nav>
          </div>
          <div className="flex items-center gap-3">{userRow}</div>
        </div>
      </div>
    </header>
  );
}
