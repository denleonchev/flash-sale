import { auth0 } from "@/lib/auth0";
import { isAdminSession } from "@/lib/admin-ticket";
import { getSales } from "./get-sales";

/**
 * Catalog page — S-1.2 (UR-1). SSR: fetch all sales server-side, render list with
 * derived state + remaining stock. Click → single-event page (S-1.1).
 */
export default async function CatalogPage() {
  const [sales, session] = await Promise.all([getSales(), auth0.getSession()]);
  const isAdmin = session ? isAdminSession(session) : false;

  if (sales.length === 0) {
    return (
      <main>
        <h1>Drops</h1>
        {isAdmin && <a href="/admin/sales/new">+ Create sale</a>}
        <p>No sales yet.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Drops</h1>
      {isAdmin && <a href="/admin/sales/new">+ Create sale</a>}
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
