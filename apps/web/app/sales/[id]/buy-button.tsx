"use client";

import { useActionState } from "react";
import { buyAction } from "./actions";
import { useOrderResult } from "./use-order-result";
import { ORDER_STATUSES } from "@flash-sale/shared";

type State =
  | { phase: "idle" }
  | { phase: "accepted"; idempotencyKey: string }
  | { phase: "error"; message: string };

const INITIAL: State = { phase: "idle" };

/**
 * Buy button with retry support (FR-18, FR-16).
 *
 * `useOrderResult` is called unconditionally at the top level (hooks rule).
 * States:
 *  - confirmed / sold_out → terminal message, no further action.
 *  - failed               → show "Try again" button so buyer can retry.
 *  - accepted + no result → "Processing…" while worker runs.
 *  - idle / error         → buy form.
 */
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

  const orderStatus = useOrderResult(saleId);

  // FR-6: signed-out buyers are asked to sign in; no order can be placed.
  if (!signedIn) {
    return <a href={`/auth/login?returnTo=/sales/${saleId}`}>Sign in to buy</a>;
  }

  if (orderStatus === ORDER_STATUSES.CONFIRMED) return <p>Confirmed!</p>;
  if (orderStatus === ORDER_STATUSES.SOLD_OUT) return <p>Sold out</p>;

  // Worker is still processing — no result yet.
  if (state.phase === "accepted" && !orderStatus) return <p>Processing…</p>;

  return (
    <form action={formAction}>
      <button type="submit" disabled={pending}>
        {pending ? "Processing…" : "Buy"}
      </button>
      {orderStatus === ORDER_STATUSES.FAILED && (
        <p>Order failed. Please try again.</p>
      )}
      {state.phase === "error" && <p>{state.message}</p>}
    </form>
  );
}
