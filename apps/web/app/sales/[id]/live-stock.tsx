"use client";

import { useEffect, useState } from "react";
import { abandonCheckoutAction } from "./actions";
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
  const [checkoutReady, setCheckoutReady] = useState(!signedIn);

  // FR-29: a browser mount is the only reliable "the buyer opened the page" signal. A
  // server render is not — Next re-renders the route after server actions too, including
  // the buy action itself, which would cancel a payment that is still in 3DS.
  // Buy stays disabled until the call returns, so it can never hit an order created
  // by this page.
  useEffect(() => {
    if (!signedIn) return;
    let active = true;
    void abandonCheckoutAction(saleId).finally(() => {
      if (active) setCheckoutReady(true);
    });
    return () => {
      active = false;
    };
  }, [saleId, signedIn]);

  if (stock <= 0) {
    return <p className="text-center text-zinc-400 font-semibold py-2">Sold out</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Ends in</p>
          <p className="font-mono text-2xl font-bold text-zinc-50">
            <Countdown targetAt={endsAt} serverNow={serverNow} />
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Remaining</p>
          <p className="font-mono text-2xl font-bold text-red-400">{stock}</p>
        </div>
      </div>
      <BuyButton
        saleId={saleId}
        signedIn={signedIn}
        orderStatus={orderStatus}
        ready={checkoutReady}
      />
    </div>
  );
}
