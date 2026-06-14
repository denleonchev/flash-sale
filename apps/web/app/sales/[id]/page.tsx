import { notFound } from "next/navigation";
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

  const soldOut = sale.state === "ended" && sale.remainingStock <= 0;

  return (
    <main>
      <h1>{sale.title}</h1>

      {sale.state === "live" && (
        <>
          <p>
            <strong>Live</strong> — {sale.remainingStock} left
          </p>
          <p>
            Ends in <Countdown targetIso={sale.endsAt} serverNowIso={sale.serverNow} />
          </p>
          <button type="button">Buy</button>
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
            <Countdown targetIso={sale.startsAt} serverNowIso={sale.serverNow} />
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
