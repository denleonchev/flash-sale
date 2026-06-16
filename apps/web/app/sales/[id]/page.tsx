import { notFound } from "next/navigation";
import { auth0 } from "@/lib/auth0";
import { BuyButton } from "./buy-button";
import { Countdown } from "./countdown";
import { getSale } from "./get-sale";

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
        <>
          <p>
            <strong>Live</strong> — {sale.remainingStock} left
          </p>
          <p>
            Ends in <Countdown targetAt={sale.endsAt} serverNow={sale.serverNow} />
          </p>
          <BuyButton saleId={sale.id} signedIn={!!session} />
        </>
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
