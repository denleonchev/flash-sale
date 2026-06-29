"use client";

import { useState } from "react";

const ROLES = [
  { value: "", label: "Buyer" },
  { value: "moderator", label: "Moderator" },
  { value: "admin", label: "Admin" },
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
    <div className="fixed bottom-0 inset-x-0 z-50 border-t border-zinc-800 bg-zinc-900 px-4 py-2 flex items-center gap-3 text-xs text-zinc-400">
      <span>Dev role:</span>
      <select
        value={currentRole}
        onChange={handleChange}
        disabled={loading}
        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-200 text-xs disabled:opacity-50"
      >
        {ROLES.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {loading && <span className="text-zinc-500">switching…</span>}
      {error && <span className="text-red-400">{error}</span>}
    </div>
  );
}
