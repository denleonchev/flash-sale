"use client";

import { useEffect, useState } from "react";
import { SOCKET_EVENTS } from "@flash-sale/shared";
import { getSocket } from "@/lib/socket";
import { SaleStockUpdatedSchema } from "@/lib/schemas/sale-stock-updated.schema";

/**
 * Keeps one sale's remaining stock live (S-3.1, FR-17). Seeded with the
 * server-rendered count, then updated over the shared Socket.IO connection: join the
 * sale room and apply every `sale:stock:updated` event. The socket is the only browser→api path
 * (§1), so it carries both live updates and the snapshot the gateway pushes on
 * (re)subscribe — that snapshot, re-requested on every reconnect and on mount, is how
 * a dropped connection or a navigation never leaves a stale number (FR-19).
 *
 * Only listeners and the room subscription are scoped to this hook; the connection
 * itself is a singleton (see getSocket) and is never disconnected here. The number is
 * display-only — the server stays the sole authority on stock (NFR-9).
 */
export function useSaleStock(saleId: string, initialStock: number): number {
  const [stock, setStock] = useState(initialStock);

  useEffect(() => {
    const socket = getSocket();
    const subscribeToSale = () =>
      socket.emit(SOCKET_EVENTS.SALE_SUBSCRIBE, { saleId });
    const onSaleStockUpdated = (raw: unknown) => {
      const parsed = SaleStockUpdatedSchema.safeParse(raw);
      if (parsed.success && parsed.data.saleId === saleId) {
        setStock(parsed.data.remainingStock);
      }
    };

    socket.on("connect", subscribeToSale);
    // Already connected (singleton reused across navigation)? `connect` won't fire
    // again, so subscribe now to get the snapshot.
    if (socket.connected) subscribeToSale();

    socket.on(SOCKET_EVENTS.SALE_STOCK_UPDATED, onSaleStockUpdated);

    return () => {
      socket.off("connect", subscribeToSale);
      socket.off(SOCKET_EVENTS.SALE_STOCK_UPDATED, onSaleStockUpdated);
    };
  }, [saleId]);

  return stock;
}
