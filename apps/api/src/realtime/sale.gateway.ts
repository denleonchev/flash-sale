import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import {
  SOCKET_EVENTS,
  getSaleRoomId,
  type SaleStockUpdatedPayload,
} from "@flash-sale/shared";
import { SalesService } from "../sales/sales.service.js";

/**
 * Realtime gateway for sale updates (§6). Clients subscribe to a sale and receive
 * stock changes for it. The Redis adapter (see RedisIoAdapter) makes broadcasts
 * cross-instance.
 *
 * The Socket.IO connection is the only browser→api path (§1): pages and all other
 * client HTTP go through web; nginx routes `/socket.io` here. `cors.origin: true`
 * only matters in dev, where web and api run on different ports without nginx.
 */
@WebSocketGateway({ cors: { origin: true } })
export class SaleGateway {
  private readonly logger = new Logger(SaleGateway.name);

  constructor(private readonly sales: SalesService) {}

  @WebSocketServer()
  private readonly server!: Server;

  /**
   * Client asks to follow one sale → join its room. We only ever broadcast into a
   * sale room (never globally), so a client hears about the sales it watches only.
   *
   * On (re)subscribe we push the current stock snapshot to this client alone, so a
   * freshly connected or reconnected client never shows a stale number — over the
   * socket, the single browser→api channel, with no extra public REST path. (FR-19)
   */
  @SubscribeMessage(SOCKET_EVENTS.SALE_SUBSCRIBE)
  async handleSaleSubscribe(
    @MessageBody() data: { saleId?: unknown },
    @ConnectedSocket() socket: Socket,
  ): Promise<{ subscribed: string } | { error: string }> {
    if (typeof data?.saleId !== "string" || data.saleId.length === 0) {
      return { error: "saleId is required" };
    }
    const room = getSaleRoomId(data.saleId);
    await socket.join(room);
    this.logger.log(`socket ${socket.id} joined ${room}`);

    const sale = await this.sales.getSaleById(data.saleId);
    if (sale) {
      socket.emit(SOCKET_EVENTS.SALE_STOCK_UPDATED, {
        saleId: sale.id,
        remainingStock: sale.remainingStock,
      } satisfies SaleStockUpdatedPayload);
    }
    return { subscribed: room };
  }

  /**
   * Emit the new stock count to everyone watching the sale. Goes through the Redis
   * adapter, so it fans out to all api instances. (NFR-10, FR-17)
   */
  broadcastStock(payload: SaleStockUpdatedPayload): void {
    this.server
      .to(getSaleRoomId(payload.saleId))
      .emit(SOCKET_EVENTS.SALE_STOCK_UPDATED, payload);
  }
}
