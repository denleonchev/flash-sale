"use client";
import { useFormStatus } from "react-dom";
import { endSaleAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}>
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
