"use client";

import { useState } from "react";
import { Spinner } from "@/components/ui/spinner";

const ROLES = [
  { value: "", label: "Buyer", hint: "buy items in a sale" },
  { value: "moderator", label: "Moderator", hint: "Buyer + review fraud flags" },
  { value: "admin", label: "Admin", hint: "Moderator + create and run sales" },
] as const;

type Role = (typeof ROLES)[number]["value"];

export function RoleSwitcher({ currentRole }: { currentRole: Role }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value as Role;
    setLoading(true);
    setError(null);

    const res = await fetch("/api/dev/role", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error ?? `Error ${res.status}`);
      setLoading(false);
      return;
    }

    // prompt=login forces Auth0 to re-run post-login Actions so the new role
    // appears in the freshly issued ID token
    const returnTo = encodeURIComponent(window.location.pathname);
    window.location.href = `/auth/login?prompt=login&returnTo=${returnTo}`;
  }

  return (
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-zinc-800 bg-zinc-900 px-4 py-2.5 text-sm text-zinc-400">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5">
        <span className="font-medium text-zinc-300">Demo: switch role to explore</span>
        <select
          value={currentRole}
          onChange={handleChange}
          disabled={loading}
          aria-label="Demo role"
          className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-sm disabled:opacity-50"
        >
          {ROLES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label} — {r.hint}
            </option>
          ))}
        </select>
        {/* Slot is always rendered so the row keeps its width when switching starts. */}
        <span
          role="status"
          aria-label={loading ? "Switching role" : undefined}
          className="w-4 h-4 shrink-0"
        >
          {loading && <Spinner className="w-4 h-4" />}
        </span>
        {error && (
          <span aria-live="polite" className="basis-full text-center text-red-400">
            {error}
          </span>
        )}
      </div>
    </div>
  );
}
