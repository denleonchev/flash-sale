"use client";
import { useActionState } from "react";
import { createSaleAction, type CreateSaleState } from "./actions";

const initialState: CreateSaleState = {};

export function CreateSaleForm() {
  const [state, formAction, pending] = useActionState(createSaleAction, initialState);

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="title">Title</label>
        <input id="title" name="title" type="text" required maxLength={120} />
      </div>
      <div>
        <label htmlFor="stockTotal">Stock</label>
        <input id="stockTotal" name="stockTotal" type="number" min="1" required />
      </div>
      <div>
        <label htmlFor="price">Price (USD)</label>
        <input id="price" name="price" type="number" min="0.01" step="0.01" required />
      </div>
      <div>
        <label htmlFor="startsAt">Starts at</label>
        <input id="startsAt" name="startsAt" type="datetime-local" required />
      </div>
      <div>
        <label htmlFor="endsAt">Ends at</label>
        <input id="endsAt" name="endsAt" type="datetime-local" required />
      </div>
      <button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create sale"}
      </button>
      {state.errorMessage && <p>{state.errorMessage}</p>}
    </form>
  );
}
