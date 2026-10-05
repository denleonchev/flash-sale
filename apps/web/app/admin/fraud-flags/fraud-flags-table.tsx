"use client";
import { Fragment, useOptimistic, useState, useTransition } from "react";
import { ChevronRight } from "lucide-react";
import { FRAUD_FLAG_STATUSES, type FraudFlag, type FraudFlagStatus } from "@flash-sale/shared";
import { setFlagStatusAction } from "./actions";
import { FlagPrecedents } from "./flag-precedents";
import { RiskBadge } from "./risk-badge";
import { FRAUD_FLAG_STATUS_LABELS } from "./status-labels";

const statusColor: Record<FraudFlagStatus, string> = {
  open: "text-amber-400",
  confirmed: "text-red-400",
  rejected: "text-zinc-500",
};

const COLUMNS = ["Risk", "Buyer", "Sale", "Reason", "Status", "Created"];

export function FraudFlagsTable({ flags }: { flags: FraudFlag[] }) {
  const [error, setError] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<ReadonlySet<string>>(new Set());
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(new Set());
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

  function toggleExpanded(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
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
            <th className="w-px px-2 py-3">
              <span className="sr-only">Precedents</span>
            </th>
            {COLUMNS.map((h) => (
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
          {optimisticFlags.map((f) => {
            const isExpanded = expandedIds.has(f.id);
            const precedentsId = `precedents-${f.id}`;
            return (
              <Fragment key={f.id}>
                <tr className="bg-zinc-900 hover:bg-zinc-800/40 transition-colors">
                  <td className="px-2 py-3">
                    {f.citations.length > 0 && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(f.id)}
                        aria-expanded={isExpanded}
                        aria-controls={precedentsId}
                        aria-label={`${isExpanded ? "Hide" : "Show"} ${f.citations.length} precedents for flag ${f.id}`}
                        className={`inline-flex items-center gap-1 rounded-full border py-1 pl-1.5 pr-2.5 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 ${
                          isExpanded
                            ? "border-zinc-600 bg-zinc-800 text-zinc-100"
                            : "border-zinc-800 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-800 hover:text-zinc-100"
                        }`}
                      >
                        <ChevronRight
                          aria-hidden="true"
                          className={`size-3.5 transition-transform duration-150 ${isExpanded ? "rotate-90" : ""}`}
                        />
                        {f.citations.length}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <RiskBadge risk={f.risk} />
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
                {isExpanded && (
                  <tr id={precedentsId} className="bg-zinc-950/60">
                    <td colSpan={COLUMNS.length + 1} className="px-6 py-3">
                      {/* inline-size containment: the nested table is wider than the outer
                          columns need, and without this the browser re-sizes every outer
                          column each time a row opens. */}
                      <div className="overflow-x-auto [contain:inline-size]">
                        <FlagPrecedents flag={f} />
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
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
