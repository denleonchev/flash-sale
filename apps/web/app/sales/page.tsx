import Link from "next/link";
import { Plus } from "lucide-react";
import { getSession } from "@/lib/session";
import { getSales } from "./get-sales";
import { getSalesSearch } from "@/lib/get-sales-search";
import { SaleSearchForm } from "./sale-search-form";
import { Badge } from "@/components/ui/badge";

/**
 * Catalog page — S-1.2 (UR-1). SSR: fetch all sales server-side, render list with
 * derived state + remaining stock. Click → single-event page (S-1.1).
 * With ?q=, runs semantic search (FR-26) and shows ranked results.
 */
export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  const [sales, session] = await Promise.all([
    query ? getSalesSearch(query) : getSales(),
    getSession(),
  ]);
  const isAdmin = session?.isAdmin ?? false;

  return (
    <main className="w-full max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-zinc-50">Sales</h1>
        {isAdmin && (
          <Link
            href="/admin/sales/new"
            className="flex items-center gap-1.5 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-100 text-sm font-medium px-3 py-2 rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create sale
          </Link>
        )}
      </div>

      <SaleSearchForm initialQuery={query} />

      {query && <p className="text-zinc-500 text-sm mt-4">Results for &ldquo;{query}&rdquo;</p>}

      {sales.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          {query ? "No matching sales found." : "No sales yet."}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sales.map((sale) => (
            <Link key={sale.id} href={`/sales/${sale.id}`} className="block group">
              <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-5 hover:border-zinc-700 hover:bg-zinc-800/40 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <SaleBadge state={sale.state} />
                  <span className="text-zinc-500 text-xs font-mono">
                    {sale.remainingStock} left
                  </span>
                </div>
                <h2 className="font-semibold text-zinc-100 group-hover:text-red-400 transition-colors line-clamp-1">
                  {sale.title}
                </h2>
                {sale.description && (
                  <p className="text-zinc-500 text-sm mt-1 line-clamp-2">{sale.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}

function SaleBadge({ state }: { state: string }) {
  if (state === "live") return <Badge variant="live">Live</Badge>;
  if (state === "upcoming") return <Badge variant="upcoming">Upcoming</Badge>;
  return <Badge variant="ended">Ended</Badge>;
}
