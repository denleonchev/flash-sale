import Link from "next/link";
import { Zap } from "lucide-react";
import { getSession } from "@/lib/session";

export async function SiteHeader() {
  const session = await getSession();
  const isAdmin = session?.isAdmin ?? false;
  const canReviewFraud = isAdmin || (session?.hasRole("moderator") ?? false);

  const logo = (
    <Link
      href="/sales"
      className="flex items-center gap-2 font-bold text-zinc-50 hover:text-red-400 transition-colors"
    >
      <Zap className="w-5 h-5 text-red-500 fill-red-500" />
      <span>FLASH SALE</span>
    </Link>
  );

  const navLinks = (
    <>
      <Link href="/sales" className="text-zinc-400 hover:text-zinc-50 transition-colors">
        Catalog
      </Link>
      {canReviewFraud && (
        <Link
          href="/admin/fraud-flags"
          className="text-zinc-400 hover:text-zinc-50 transition-colors"
        >
          Fraud flags
        </Link>
      )}
    </>
  );

  const userRow = session ? (
    <>
      <span className="text-zinc-50 font-medium truncate">
        {session.user.name ?? session.user.email}
      </span>
      {isAdmin && <span className="text-xs text-red-400">admin</span>}
      <a
        href="/auth/logout"
        className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
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
        <div className="sm:hidden py-3 flex flex-col gap-2 text-sm">
          <div className="flex justify-center">{logo}</div>
          <nav className="flex items-center justify-center gap-4">{navLinks}</nav>
          <div className="flex items-center justify-center gap-3">{userRow}</div>
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
