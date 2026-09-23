"use client";

import { useFormStatus } from "react-dom";
import { startDemoAction } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-block w-full rounded-md border border-zinc-700 bg-zinc-800 px-6 py-3 font-semibold text-zinc-100 transition-colors hover:bg-zinc-700 disabled:opacity-50"
    >
      {pending ? "Opening demo…" : "Try demo account"}
    </button>
  );
}

export function DemoLoginButton() {
  return (
    <form action={startDemoAction}>
      <SubmitButton />
    </form>
  );
}
