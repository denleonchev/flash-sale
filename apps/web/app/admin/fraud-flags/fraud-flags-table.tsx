"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FraudFlag } from "@flash-sale/shared";
import { reviewFlagAction } from "./actions";

const riskBadge: Record<string, string> = {
  high: "bg-red-950 text-red-400 border-red-900",
  medium: "bg-amber-950 text-amber-400 border-amber-900",
  low: "bg-emerald-950 text-emerald-400 border-emerald-900",
};

export function FraudFlagsTable({ flags }: { flags: FraudFlag[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  async function handleReview(id: string) {
    setPending(id);
    await reviewFlagAction(id);
    setPending(null);
    router.refresh();
  }

  if (flags.length === 0) {
    return <p className="text-zinc-600 text-center py-16">No fraud flags found.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="min-w-[640px] w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            {["Risk", "Buyer", "Sale", "Reason", "Status", "Created", ""].map((h) => (
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
          {flags.map((f) => (
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
              <td className="px-4 py-3 text-zinc-400 max-w-xs truncate">{f.reason}</td>
              <td className="px-4 py-3">
                <span
                  className={`text-xs font-medium ${
                    f.status === "open" ? "text-amber-400" : "text-zinc-500"
                  }`}
                >
                  {f.status}
                </span>
              </td>
              <td className="px-4 py-3 text-zinc-500 text-xs font-mono whitespace-nowrap">
                {f.createdAt.slice(0, 19).replace("T", " ")} UTC
              </td>
              <td className="px-4 py-3 text-right">
                {f.status === "open" && (
                  <button
                    disabled={pending === f.id}
                    onClick={() => void handleReview(f.id)}
                    className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 disabled:opacity-50 transition-colors"
                  >
                    {pending === f.id ? "Saving…" : "Mark reviewed"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
