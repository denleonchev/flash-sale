"use client";

import { BuyButton } from "./buy-button";
import { Countdown } from "./countdown";
import { useSaleStock } from "./use-sale-stock";
import { useOrderResult } from "./use-order-result";

/**
 * Live view of an in-progress sale (S-3.1, FR-17). Renders the live stock count
 * (kept current by `useSaleStock`), the countdown and the Buy action. When stock
 * reaches 0 it flips to "Sold out" and drops Buy and the countdown.
 */
export function LiveStock({
  saleId,
  initialStock,
  signedIn,
  endsAt,
  serverNow,
}: {
  saleId: string;
  initialStock: number;
  signedIn: boolean;
  endsAt: string;
  serverNow: string;
}) {
  const stock = useSaleStock(saleId, initialStock);
  const orderStatus = useOrderResult(saleId);

  if (stock <= 0) {
    return (
      <p>
        <strong>Sold out</strong>
      </p>
    );
  }

  return (
    <>
      <p>
        <strong>Live</strong> — {stock} left
      </p>
      <p>
        Ends in <Countdown targetAt={endsAt} serverNow={serverNow} />
      </p>
      <BuyButton saleId={saleId} signedIn={signedIn} orderStatus={orderStatus} />
    </>
  );
}
