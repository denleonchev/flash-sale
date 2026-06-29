"use client";
import { useState, useActionState } from "react";
import { Sparkles } from "lucide-react";
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

  const inputClass =
    "w-full px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50 transition-colors";

  // datetime-local gives "YYYY-MM-DDTHH:mm" without timezone. The browser's
  // new Date(string) treats it as local time → .toISOString() converts to UTC.
  // Without this the server would re-parse the bare string as UTC, shifting by
  // the user's UTC offset.
  function normalizeDates(e: React.FormEvent<HTMLFormElement>) {
    const form = e.currentTarget;
    for (const name of ["startsAt", "endsAt"]) {
      const input = form.elements.namedItem(name) as HTMLInputElement | null;
      if (input?.value) input.value = new Date(input.value).toISOString();
    }
  }

  return (
    <form action={formAction} onSubmit={normalizeDates} className="space-y-5">
      <Field label="Title" htmlFor="title">
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={120}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={busy}
          placeholder="Air Max 90 Ultra Limited"
          className={inputClass}
        />
      </Field>

      <Field label="Description" htmlFor="description">
        <textarea
          id="description"
          name="description"
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={busy}
          rows={4}
          placeholder="Describe the sale…"
          className={`${inputClass} resize-none`}
        />
        <button
          type="button"
          onClick={handleImprove}
          disabled={busy || !title.trim()}
          className="mt-2 flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 disabled:opacity-40 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          {improving ? "Improving…" : "Improve with AI"}
        </button>
        {improveError && <p className="text-red-400 text-xs mt-1">{improveError}</p>}
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Stock" htmlFor="stockTotal">
          <input
            id="stockTotal"
            name="stockTotal"
            type="number"
            min="1"
            required
            disabled={busy}
            placeholder="100"
            className={inputClass}
          />
        </Field>
        <Field label="Price (USD)" htmlFor="price">
          <input
            id="price"
            name="price"
            type="number"
            min="0.01"
            step="0.01"
            required
            disabled={busy}
            placeholder="49.99"
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Starts at" htmlFor="startsAt">
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            disabled={busy}
            className={inputClass}
          />
        </Field>
        <Field label="Ends at" htmlFor="endsAt">
          <input
            id="endsAt"
            name="endsAt"
            type="datetime-local"
            required
            disabled={busy}
            className={inputClass}
          />
        </Field>
      </div>

      <button
        type="submit"
        disabled={busy}
        className="w-full py-3 rounded-md bg-red-600 hover:bg-red-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white font-semibold transition-colors"
      >
        {pending ? "Creating…" : "Create sale"}
      </button>

      {state.errorMessage && (
        <p className="text-red-400 text-sm text-center">{state.errorMessage}</p>
      )}
    </form>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-zinc-300">
        {label}
      </label>
      {children}
    </div>
  );
}
