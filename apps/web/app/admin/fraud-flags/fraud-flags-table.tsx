"use client";
import { useOptimistic, useState, useTransition } from "react";
import { FRAUD_FLAG_STATUSES, type FraudFlag, type FraudFlagStatus } from "@flash-sale/shared";
import { setFlagStatusAction } from "./actions";
import { FRAUD_FLAG_STATUS_LABELS } from "./status-labels";

const statusColor: Record<FraudFlagStatus, string> = {
  open: "text-amber-400",
  confirmed: "text-red-400",
  rejected: "text-zinc-500",
};

const riskBadge: Record<string, string> = {
  high: "bg-red-950 text-red-400 border-red-900",
  medium: "bg-amber-950 text-amber-400 border-amber-900",
  low: "bg-emerald-950 text-emerald-400 border-emerald-900",
};

export function FraudFlagsTable({ flags }: { flags: FraudFlag[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [, startTransition] = useTransition();
  const [optimisticFlags, applyOptimisticStatus] = useOptimistic(
    flags,
    (current: FraudFlag[], update: { id: string; status: FraudFlagStatus }) =>
      current.map((f) => (f.id === update.id ? { ...f, status: update.status } : f)),
  );

  function handleStatusChange(id: string, status: FraudFlagStatus) {
    setError(null);
    setPendingIds((prev) => new Set(prev).add(id));
    startTransition(async () => {
      applyOptimisticStatus({ id, status });
      const result = await setFlagStatusAction(id, status);
      if (result.error) setError(result.error);
      setPendingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  }

  if (optimisticFlags.length === 0) {
    return <p className="text-zinc-600 text-center py-16">No fraud flags found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800 w-full max-w-full">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            {["Risk", "Buyer", "Sale", "Reason", "Status", "Created"].map((h) => (
              <th
                key={h}
                className="px-4 py-3 text-left text-xs font-semibold text-zinc-500 uppercase tracking-wide"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/60">
          {optimisticFlags.map((f) => (
            <tr key={f.id} className="bg-zinc-900 hover:bg-zinc-800/40 transition-colors">
              <td className="px-4 py-3">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                    riskBadge[f.risk] ?? "bg-zinc-800 text-zinc-400 border-zinc-700"
                  }`}
                >
                  {f.risk}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-300">
                {f.buyerName ?? f.buyerEmail ?? f.buyerId}
              </td>
              <td className="px-4 py-3 text-zinc-300">{f.saleTitle}</td>
              <td className="px-4 py-3 text-zinc-400 max-w-xs">{f.reason}</td>
              <td className="px-4 py-3">
                <select
                  value={f.status}
                  disabled={pendingIds.has(f.id)}
                  aria-label={`Status for flag ${f.id}`}
                  onChange={(e) => handleStatusChange(f.id, e.target.value as FraudFlagStatus)}
                  className={`bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${statusColor[f.status]}`}
                >
                  {Object.values(FRAUD_FLAG_STATUSES).map((s) => (
                    <option key={s} value={s} className="text-zinc-200">
                      {FRAUD_FLAG_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-4 py-3 text-zinc-500 text-xs font-mono whitespace-nowrap">
                {f.createdAt.slice(0, 19).replace("T", " ")} UTC
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {error && (
        <p aria-live="polite" className="px-4 py-2 text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
