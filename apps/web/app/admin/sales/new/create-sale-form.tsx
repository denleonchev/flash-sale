"use client";
import { useState, useActionState } from "react";
import { createSaleAction, type CreateSaleState } from "./actions";

const initialState: CreateSaleState = {};

export function CreateSaleForm() {
  const [state, formAction, pending] = useActionState(createSaleAction, initialState);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [improving, setImproving] = useState(false);
  const [improveError, setImproveError] = useState<string | null>(null);

  const busy = pending || improving;

  async function handleImprove() {
    setImproving(true);
    setImproveError(null);
    try {
      const res = await fetch("/api/sales/improve-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });
      if (!res.ok) {
        setImproveError("Failed to improve — try again");
        return;
      }
      const data = (await res.json()) as { title: string; description: string };
      setTitle(data.title);
      setDescription(data.description);
    } catch {
      setImproveError("Network error");
    } finally {
      setImproving(false);
    }
  }

  return (
    <form action={formAction}>
      <div>
        <label htmlFor="title">Title</label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
        />
      </div>
      <div>
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
          rows={4}
        />
        <button
          type="button"
          onClick={handleImprove}
          disabled={busy || !title.trim()}
        >
          {improving ? "Improving…" : "Improve title & description"}
        </button>
        {improveError && <p>{improveError}</p>}
      </div>
      <div>
        <label htmlFor="stockTotal">Stock</label>
        <input id="stockTotal" name="stockTotal" type="number" min="1" required disabled={busy} />
      </div>
      <div>
        <label htmlFor="price">Price (USD)</label>
        <input id="price" name="price" type="number" min="0.01" step="0.01" required disabled={busy} />
      </div>
      <div>
        <label htmlFor="startsAt">Starts at</label>
        <input id="startsAt" name="startsAt" type="datetime-local" required disabled={busy} />
      </div>
      <div>
        <label htmlFor="endsAt">Ends at</label>
        <input id="endsAt" name="endsAt" type="datetime-local" required disabled={busy} />
      </div>
      <button type="submit" disabled={busy}>
        {pending ? "Creating…" : "Create sale"}
      </button>
      {state.errorMessage && <p>{state.errorMessage}</p>}
    </form>
  );
}
