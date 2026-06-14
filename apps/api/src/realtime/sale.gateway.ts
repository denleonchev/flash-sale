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
  type StockUpdatePayload,
} from "@flash-sale/shared";

/**
 * Realtime gateway for sale updates (§6). Clients subscribe to a sale and receive
 * stock changes for it. The Redis adapter (see RedisIoAdapter) makes broadcasts
 * cross-instance. `cors.origin: true` reflects the request origin so the browser
 * can connect to api directly even when pages are served from web.
 */
@WebSocketGateway({ cors: { origin: true } })
export class SaleGateway {
  private readonly logger = new Logger(SaleGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  /**
   * Client asks to follow one sale → join its room. We only ever broadcast into a
   * sale room (never globally), so a client hears about the sales it watches only.
   */
  @SubscribeMessage("subscribe")
  handleSubscribe(
    @MessageBody() data: { saleId?: unknown },
    @ConnectedSocket() client: Socket,
  ): { subscribed: string } | { error: string } {
    if (typeof data?.saleId !== "string" || data.saleId.length === 0) {
      return { error: "saleId is required" };
    }
    const room = getSaleRoomId(data.saleId);
    void client.join(room);
    this.logger.log(`socket ${client.id} joined ${room}`);
    return { subscribed: room };
  }

  /**
   * Emit the new stock count to everyone watching the sale. Goes through the Redis
   * adapter, so it fans out to all api instances. (NFR-10, FR-17)
   */
  broadcastStock(payload: StockUpdatePayload): void {
    this.server
      .to(getSaleRoomId(payload.saleId))
      .emit(SOCKET_EVENTS.STOCK_UPDATE, payload);
  }
}
