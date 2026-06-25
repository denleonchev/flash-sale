"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { FraudFlag } from "@flash-sale/shared";
import { reviewFlagAction } from "./actions";

const RISK_COLOR: Record<string, string> = {
  high: "red",
  medium: "orange",
  low: "green",
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

  if (flags.length === 0) return <p>No fraud flags found.</p>;

  return (
    <table>
      <thead>
        <tr>
          <th>Risk</th>
          <th>Buyer</th>
          <th>Sale</th>
          <th>Reason</th>
          <th>Status</th>
          <th>Created</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {flags.map((f) => (
          <tr key={f.id}>
            <td style={{ color: RISK_COLOR[f.risk] }}>{f.risk}</td>
            <td>{f.buyerName ?? f.buyerEmail ?? f.buyerId}</td>
            <td>{f.saleTitle}</td>
            <td>{f.reason}</td>
            <td>{f.status}</td>
            <td>{f.createdAt.slice(0, 19).replace("T", " ")} UTC</td>
            <td>
              {f.status === "open" && (
                <button disabled={pending === f.id} onClick={() => void handleReview(f.id)}>
                  {pending === f.id ? "Saving…" : "Mark reviewed"}
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
