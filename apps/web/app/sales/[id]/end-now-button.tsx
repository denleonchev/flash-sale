"use client";
import { useFormStatus } from "react-dom";
import { endSaleAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-950 hover:bg-red-900 border border-red-900 text-red-400 disabled:opacity-50 transition-colors"
    >
      {pending ? "Ending…" : "End now"}
    </button>
  );
}

export function EndNowButton({ saleId }: { saleId: string }) {
  return (
    <form action={endSaleAction.bind(null, saleId)}>
      <SubmitButton />
    </form>
  );
}
