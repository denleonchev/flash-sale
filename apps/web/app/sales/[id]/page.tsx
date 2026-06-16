import { notFound } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { Countdown } from "./countdown";
import { getSale } from "./get-sale";
import { LiveStock } from "./live-stock";

/**
 * Event (sale) view — S-1.1 (FR-5). SSR server component: fetch the sale on the
 * server, render product, state, stock left and time left. The Buy action and live
 * updates arrive in later cards (S-4.1 / UR-3); here Buy is only enabled/disabled by
 * state.
 */
export default async function SalePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sale = await getSale(id);
  if (!sale) {
    notFound();
  }

  const session = await auth0.getSession();
  const soldOut = sale.state === "ended" && sale.remainingStock <= 0;
  // FR-17: live stock, countdown and Buy for an in-progress sale render client-side
  // (LiveStock) so Socket.IO can keep the number current. The upcoming branch stays
  // server-rendered — nothing is live before the sale starts.

  return (
    <main>
      {session && (
        <p>
          Signed in as {session.user.name ?? session.user.email ?? "buyer"} ·{" "}
          <a href="/auth/logout">Sign out</a>
        </p>
      )}

      <h1>{sale.title}</h1>

      {sale.state === "live" && (
        <LiveStock
          saleId={sale.id}
          initialStock={sale.remainingStock}
          signedIn={!!session}
          endsAt={sale.endsAt}
          serverNow={sale.serverNow}
        />
      )}

      {sale.state === "upcoming" && (
        <>
          <p>
            <strong>Upcoming</strong> — starts{" "}
            {new Date(sale.startsAt).toLocaleString()}
          </p>
          <p>
            Starts in{" "}
            <Countdown targetAt={sale.startsAt} serverNow={sale.serverNow} />
          </p>
          <button type="button" disabled>
            Buy
          </button>
        </>
      )}

      {sale.state === "ended" && (
        <p>
          <strong>{soldOut ? "Sold out" : "Ended"}</strong>
        </p>
      )}
    </main>
  );
}
