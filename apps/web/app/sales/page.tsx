import { getSales } from "./get-sales";

/**
 * Catalog page — S-1.2 (UR-1). SSR: fetch all sales server-side, render list with
 * derived state + remaining stock. Click → single-event page (S-1.1).
 */
export default async function CatalogPage() {
  const sales = await getSales();

  if (sales.length === 0) {
    return (
      <main>
        <h1>Drops</h1>
        <p>No sales yet.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Drops</h1>
      <ul>
        {sales.map((sale) => (
          <li key={sale.id}>
            <a href={`/sales/${sale.id}`}>
              {sale.title} — {sale.state} — {sale.remainingStock} left
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
