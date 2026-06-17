"use client";

import { useActionState } from "react";
import { buyAction } from "./actions";
import { useOrderResult } from "./use-order-result";
import type { OrderStatus } from "@flash-sale/shared";

type State =
  | { phase: "idle" }
  | { phase: "accepted"; idempotencyKey: string }
  | { phase: "error"; message: string };

const INITIAL: State = { phase: "idle" };

const RESULT_LABELS: Record<OrderStatus, string> = {
  confirmed: "Confirmed!",
  sold_out: "Sold out",
  failed: "Payment failed",
};

/**
 * Displays the buy form; on success renders `OrderOutcome` which listens for the
 * per-buyer result over Socket.IO (FR-18). `OrderOutcome` is a separate component
 * so `useOrderResult` is not called conditionally — hooks must be at the top level.
 */
function OrderOutcome({ saleId }: { saleId: string }) {
  const status = useOrderResult(saleId);
  if (!status) return <p>Processing…</p>;
  return <p>{RESULT_LABELS[status]}</p>;
}

export function BuyButton({
  saleId,
  signedIn,
}: {
  saleId: string;
  signedIn: boolean;
}) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async () => {
      const result = await buyAction(saleId);
      if (!result.ok) return { phase: "error", message: result.message };
      return { phase: "accepted", idempotencyKey: result.idempotencyKey };
    },
    INITIAL,
  );

  // FR-6: signed-out buyers are asked to sign in; no order can be placed.
  if (!signedIn) {
    return <a href={`/auth/login?returnTo=/sales/${saleId}`}>Sign in to buy</a>;
  }

  if (state.phase === "accepted") {
    return <OrderOutcome saleId={saleId} />;
  }

  return (
    <form action={formAction}>
      <button type="submit" disabled={pending}>
        {pending ? "Processing…" : "Buy"}
      </button>
      {state.phase === "error" && <p>{state.message}</p>}
    </form>
  );
}
