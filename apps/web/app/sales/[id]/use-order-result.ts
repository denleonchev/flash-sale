"use client";

import { useEffect, useState } from "react";
import { SOCKET_EVENTS, type OrderStatus } from "@flash-sale/shared";
import { getSocket } from "@/lib/socket";
import { OrderResultUpdatedSchema } from "@/lib/schemas/order-result-updated.schema";

/**
 * Delivers the signed-in buyer's own order result for one sale (S-3.2, FR-18).
 * On mount (and on every reconnect) emits `ORDER_RESULT_SUBSCRIBE` so the api returns
 * the latest finalized result without requiring a full `SALE_SUBSCRIBE`. Returns
 * `null` until the result arrives.
 */
export function useOrderResult(saleId: string): OrderStatus | null {
  const [status, setStatus] = useState<OrderStatus | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const onOrderResultUpdated = (raw: unknown) => {
      const parsed = OrderResultUpdatedSchema.safeParse(raw);
      if (parsed.success && parsed.data.saleId === saleId) {
        setStatus(parsed.data.status);
      }
    };

    const subscribeOrderResult = () =>
      socket.emit(SOCKET_EVENTS.ORDER_RESULT_SUBSCRIBE, { saleId });

    socket.on(SOCKET_EVENTS.ORDER_RESULT_UPDATED, onOrderResultUpdated);
    socket.on("connect", subscribeOrderResult);
    if (socket.connected) subscribeOrderResult();

    return () => {
      socket.off(SOCKET_EVENTS.ORDER_RESULT_UPDATED, onOrderResultUpdated);
      socket.off("connect", subscribeOrderResult);
    };
  }, [saleId]);

  return status;
}
