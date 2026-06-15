"use client";

import { useActionState } from "react";
import { buyAction } from "./actions";

type State =
  | { phase: "idle" }
  | { phase: "accepted"; idempotencyKey: string }
  | { phase: "error"; message: string };

const INITIAL: State = { phase: "idle" };

export function BuyButton({ saleId }: { saleId: string }) {
  const [state, formAction, pending] = useActionState<State, FormData>(
    async (_prev, formData) => {
      const buyerId = (formData.get("buyerId") as string | null)?.trim() ?? "";
      if (!buyerId) return { phase: "error", message: "Name is required" };

      const result = await buyAction(saleId, buyerId);
      if (!result.ok) return { phase: "error", message: result.message };
      return { phase: "accepted", idempotencyKey: result.idempotencyKey };
    },
    INITIAL,
  );

  if (state.phase === "accepted") {
    return <p>Order accepted! Reference: {state.idempotencyKey}</p>;
  }

  return (
    <form action={formAction}>
      {/* Temporary until S-2.5 adds auth — buyer identifies by name */}
      <input
        name="buyerId"
        type="text"
        placeholder="Your name"
        pattern="[A-Za-z0-9_-]+"
        maxLength={64}
        required
        disabled={pending}
      />
      <button type="submit" disabled={pending}>
        {pending ? "Processing…" : "Buy"}
      </button>
      {state.phase === "error" && <p>{state.message}</p>}
    </form>
  );
}
