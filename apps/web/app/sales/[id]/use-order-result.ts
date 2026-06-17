"use client";

import { useEffect, useState } from "react";
import { SOCKET_EVENTS, type OrderStatus } from "@flash-sale/shared";
import { getSocket } from "@/lib/socket";
import { OrderResultUpdatedSchema } from "@/lib/schemas/order-result-updated.schema";

/**
 * Delivers the signed-in buyer's own order result for one sale (S-3.2, FR-18).
 * Listens for `order:result:updated` on the shared Socket.IO connection; the api
 * emits it to the buyer's private room keyed by their verified HMAC ticket.
 *
 * No emit needed on mount — the private room is joined by the api on handshake
 * (before any Buy click), and the FR-19 snapshot is pushed by `handleConnection`.
 *
 * Filters by `saleId` so the hook is safe on any sale page regardless of which
 * result arrives first on the singleton connection. Returns `null` until an event
 * arrives or the snapshot is delivered on reconnect.
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

    socket.on(SOCKET_EVENTS.ORDER_RESULT_UPDATED, onOrderResultUpdated);
    return () => {
      socket.off(SOCKET_EVENTS.ORDER_RESULT_UPDATED, onOrderResultUpdated);
    };
  }, [saleId]);

  return status;
}
