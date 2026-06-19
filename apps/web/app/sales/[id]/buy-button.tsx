"use client";

import { useActionState } from "react";
import { buyAction, type BuyState } from "./actions";
import { ORDER_STATUSES, type OrderStatus } from "@flash-sale/shared";

const BUY_INITIAL: BuyState = {};

/**
 * Buy button with retry support (FR-18, FR-16).
 *
 * `orderStatus` is the buyer's own order result, owned by the parent (LiveStock)
 * so it can coordinate the optimistic stock display with the same signal.
 * States:
 *  - confirmed / sold_out   → terminal message, no further action.
 *  - in_progress            → "Processing…" (durable socket state, enables FR-19).
 *  - accepted + no status   → "Processing…" (local bridge until socket delivers).
 *  - failed                 → show "Try again" button so buyer can retry.
 *  - idle / error           → buy form.
 */
export function BuyButton({
  saleId,
  signedIn,
  orderStatus,
}: {
  saleId: string;
  signedIn: boolean;
  orderStatus: OrderStatus | null;
}) {
  const [state, formAction, pending] = useActionState<BuyState, FormData>(
    buyAction.bind(null, saleId),
    BUY_INITIAL,
  );

  // FR-6: signed-out buyers are asked to sign in; no order can be placed.
  if (!signedIn) {
    return <a href={`/auth/login?returnTo=/sales/${saleId}`}>Sign in to buy</a>;
  }

  if (orderStatus === ORDER_STATUSES.CONFIRMED) return <p>Confirmed!</p>;
  if (orderStatus === ORDER_STATUSES.SOLD_OUT) return <p>Sold out</p>;
  const isProcessing = pending || orderStatus === ORDER_STATUSES.IN_PROGRESS;
  return (
    <form action={formAction}>
      <button type="submit" disabled={isProcessing}>
        {isProcessing ? "Processing…" : "Buy"}
      </button>
      {!pending && orderStatus === ORDER_STATUSES.FAILED && (
        <p>Order failed. Please try again.</p>
      )}
      {!pending && state.errorMessage && <p>{state.errorMessage}</p>}
    </form>
  );
}
