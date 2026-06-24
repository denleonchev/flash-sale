import { getSession } from "@/lib/session";
import { getSales } from "./get-sales";
import { getSalesSearch } from "@/lib/get-sales-search";
import { SaleSearchForm } from "./sale-search-form";

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
    <main>
      <h1>Drops</h1>
      {isAdmin && <a href="/admin/sales/new">+ Create sale</a>}
      <SaleSearchForm initialQuery={query} />
      {query && <p>Results for &ldquo;{query}&rdquo;</p>}
      {sales.length === 0 ? (
        <p>{query ? "No matching sales found." : "No sales yet."}</p>
      ) : (
        <ul>
          {sales.map((sale) => (
            <li key={sale.id}>
              <a href={`/sales/${sale.id}`}>
                {sale.title} — {sale.state} — {sale.remainingStock} left
              </a>
              {sale.description && <p>{sale.description}</p>}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
