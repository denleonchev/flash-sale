"use client";

import { useActionState } from "react";
import { buyAction } from "./actions";

type State =
  | { phase: "idle" }
  | { phase: "accepted"; idempotencyKey: string }
  | { phase: "error"; message: string };

const INITIAL: State = { phase: "idle" };

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
    return <p>Order accepted! Reference: {state.idempotencyKey}</p>;
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
