"use client";

import { useEffect, useRef, useState } from "react";
import { SOCKET_EVENTS } from "@flash-sale/shared";
import { getSocket } from "@/lib/socket";
import { SaleStockUpdatedSchema } from "@/lib/schemas/sale-stock-updated.schema";

/**
 * Keeps one sale's remaining stock live (S-3.1, FR-17). Seeded with the
 * server-rendered count, then updated on every `sale:stock:updated` event.
 * Joins the sale room on mount and re-subscribes on reconnect (FR-19).
 */
export function useSaleStock(saleId: string, initialStock: number): number {
  const [stock, setStock] = useState(initialStock);
  const lastVersion = useRef<number | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const subscribeToSaleStock = () => {
      lastVersion.current = null;
      socket.emit(SOCKET_EVENTS.SALE_STOCK_SUBSCRIBE, { saleId });
    };

    const onSaleStockUpdated = (raw: unknown) => {
      const parsed = SaleStockUpdatedSchema.safeParse(raw);
      if (!parsed.success || parsed.data.saleId !== saleId) return;
      if (lastVersion.current !== null && parsed.data.version < lastVersion.current) return;
      lastVersion.current = parsed.data.version;
      setStock(parsed.data.remainingStock);
    };

    socket.on("connect", subscribeToSaleStock);
    socket.on(SOCKET_EVENTS.SALE_STOCK_UPDATED, onSaleStockUpdated);
    if (socket.connected) subscribeToSaleStock();

    return () => {
      socket.off("connect", subscribeToSaleStock);
      socket.off(SOCKET_EVENTS.SALE_STOCK_UPDATED, onSaleStockUpdated);
    };
  }, [saleId]);

  return stock;
}
