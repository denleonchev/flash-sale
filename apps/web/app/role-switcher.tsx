"use client";

import { useState, useTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { switchRoleAction, type SwitchableRole } from "./actions";
import { useSession } from "./session-provider";

const ROLES = [
  { value: "", label: "Buyer", hint: "buy items in a sale" },
  { value: "moderator", label: "Moderator", hint: "Buyer + review fraud flags" },
  { value: "admin", label: "Admin", hint: "Moderator + create and run sales" },
] as const;

const SELECT_CLASS =
  "bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-sm disabled:opacity-50";

function RoleOptions() {
  return ROLES.map((r) => (
    <option key={r.value} value={r.value}>
      {r.label} — {r.hint}
    </option>
  ));
}

export function RoleSwitcher() {
  const { session, isLoading } = useSession();

  if (isLoading) {
    return (
      <RoleSwitcherFrame>
        {/* The real select, hidden, gives the skeleton its exact box: a guessed size made
            the bar change height when the session arrived. */}
        <span role="status" aria-label="Loading role" className="relative flex">
          <select disabled aria-hidden tabIndex={-1} className={cn(SELECT_CLASS, "invisible")}>
            <RoleOptions />
          </select>
          <Skeleton className="absolute inset-0 rounded" />
        </span>
        <span className="w-4 h-4 shrink-0" />
      </RoleSwitcherFrame>
    );
  }

  if (!session) return null;
  return <RoleSwitcherBar currentRole={session.role} />;
}

function RoleSwitcherFrame({ children }: { children: ReactNode }) {
  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-400">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        <span className="font-medium text-zinc-300">Demo: switch role to explore</span>
        {children}
      </div>
    </div>
  );
}

function RoleSwitcherBar({ currentRole }: { currentRole: SwitchableRole }) {
  // Bound to the prop, the select would snap back to the old role mid-switch.
  const [role, setRole] = useState<SwitchableRole>(currentRole);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const { refreshSession } = useSession();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const picked = e.target.value as SwitchableRole;
    setRole(picked);
    setError(null);

    startTransition(async () => {
      const result = await switchRoleAction(picked, pathname);
      if (result.error) {
        setRole(currentRole);
        setError(result.error);
        return;
      }
      await refreshSession();
    });
  }

  return (
    <RoleSwitcherFrame>
      {/* autoComplete=off: Chrome restores form state on reload, overriding the rendered
          role — React does not re-check attributes during hydration. */}
      <select
        value={role}
        onChange={handleChange}
        disabled={isPending}
        aria-label="Demo role"
        autoComplete="off"
        className={SELECT_CLASS}
      >
        <RoleOptions />
      </select>
      {/* Slot is always rendered so the row keeps its width when switching starts. */}
      <span
        role="status"
        aria-label={isPending ? "Switching role" : undefined}
        className="w-4 h-4 shrink-0"
      >
        {isPending && <Spinner className="w-4 h-4" />}
      </span>
      {error && (
        <span aria-live="polite" className="basis-full text-center text-red-400">
          {error}
        </span>
      )}
    </RoleSwitcherFrame>
  );
}
