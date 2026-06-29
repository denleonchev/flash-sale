"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

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
    <form onSubmit={handleSubmit} className="flex gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sales…"
          aria-label="Search sales"
          className="w-full pl-9 pr-4 py-2 rounded-md bg-zinc-900 border border-zinc-800 text-zinc-50 placeholder:text-zinc-600 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent transition-colors"
        />
      </div>
      <button
        type="submit"
        className="px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-sm font-medium transition-colors"
      >
        Search
      </button>
      {initialQuery && (
        <button
          type="button"
          onClick={() => {
            setQuery("");
            router.push("/sales");
          }}
          aria-label="Clear search"
          className="p-2 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </form>
  );
}
