"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Props {
  initialQuery: string;
}

export function SaleSearchForm({ initialQuery }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (q) {
      router.push(`/sales?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/sales");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search sales…"
        aria-label="Search sales"
      />
      <button type="submit">Search</button>
      {initialQuery && (
        <button type="button" onClick={() => { setQuery(""); router.push("/sales"); }}>
          Clear
        </button>
      )}
    </form>
  );
}
