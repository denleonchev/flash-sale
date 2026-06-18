import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import {
  SOCKET_EVENTS,
  getSaleRoomId,
  getUserRoomId,
  type SaleStockUpdatedPayload,
  type OrderResult,
  type OrderResultUpdatedPayload,
} from "@flash-sale/shared";
import { SalesService } from "../sales/sales.service.js";
import { OrdersService } from "../orders/orders.service.js";
import { getBuyerId } from "./socket-ticket.js";

/**
 * Realtime gateway for sale updates (§6). Clients subscribe to a sale and receive
 * stock changes for it. Authenticated buyers additionally receive their own order
 * result in a private room keyed by `buyerId`. The Redis adapter (RedisIoAdapter)
 * makes broadcasts cross-instance.
 *
 * `cors.origin: true` only matters in dev (no nginx). (NFR-10)
 */
@WebSocketGateway({ cors: { origin: true } })
export class SaleGateway implements OnGatewayConnection {
  private readonly logger = new Logger(SaleGateway.name);

  constructor(
    private readonly salesService: SalesService,
    private readonly ordersService: OrdersService,
  ) {}

  @WebSocketServer()
  private readonly server!: Server;

  /**
   * On connect: verify the HMAC ticket from `socket.handshake.auth.ticket`.
   * Authenticated → join `user:<buyerId>` room and stash `buyerId` on the socket.
   * Unauthenticated or missing ticket → remain anon; still receives public stock.
   * Never disconnects an anon socket. (FR-18)
   *
   * The per-buyer result snapshot is NOT pushed here — at connect time the buyer has
   * not yet subscribed to a sale, so `saleId` is unknown. It is pushed per-sale on
   * (re)subscribe instead (see handleSaleSubscribe, FR-19).
   *
   * Concurrency note: the buyer's socket joins the private room BEFORE any Buy click,
   * so there is no race between "result published" and "room joined". (S-3.2 plan §Correctness)
   */
  async handleConnection(socket: Socket): Promise<void> {
    const ticket = socket.handshake.auth?.ticket as string | undefined;
    if (!ticket) return;

    const buyerId = getBuyerId(ticket);
    if (!buyerId) {
      this.logger.warn(`socket ${socket.id} presented invalid/expired ticket`);
      return;
    }

    socket.data.buyerId = buyerId;
    await socket.join(getUserRoomId(buyerId));
    this.logger.log(`socket ${socket.id} joined user room for ${buyerId}`);
  }

  /**
   * Client asks for live stock updates → join sale room + push current stock snapshot
   * so a freshly connected or reconnected client never shows stale data (FR-17, FR-19).
   */
  @SubscribeMessage(SOCKET_EVENTS.SALE_STOCK_SUBSCRIBE)
  async handleSaleStockSubscribe(
    @MessageBody() data: { saleId?: unknown },
    @ConnectedSocket() socket: Socket,
  ): Promise<{ subscribed: string } | { error: string }> {
    if (typeof data?.saleId !== "string" || data.saleId.length === 0) {
      return { error: "saleId is required" };
    }
    const room = getSaleRoomId(data.saleId);
    await socket.join(room);
    this.logger.log(`socket ${socket.id} joined ${room}`);

    const sale = await this.salesService.getSaleById(data.saleId);
    if (sale) {
      socket.emit(SOCKET_EVENTS.SALE_STOCK_UPDATED, {
        saleId: sale.id,
        remainingStock: sale.remainingStock,
      } satisfies SaleStockUpdatedPayload);
    }

    return { subscribed: room };
  }

  /** FR-18/FR-19: buyer subscribes to their order result for one sale. Delivers the latest finalized result immediately if one exists. */
  @SubscribeMessage(SOCKET_EVENTS.ORDER_RESULT_SUBSCRIBE)
  async handleOrderResultSubscribe(
    @MessageBody() data: { saleId?: unknown },
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const buyerId = socket.data.buyerId as string | undefined;
    if (!buyerId || typeof data?.saleId !== "string" || !data.saleId) return;
    const result = await this.ordersService.getLatestFinalizedOrder(buyerId, data.saleId);
    if (result) {
      socket.emit(SOCKET_EVENTS.ORDER_RESULT_UPDATED, result);
    }
  }

  /** Emit new stock to everyone watching the sale. Redis adapter fans out cross-instance. (FR-17) */
  broadcastStock(payload: SaleStockUpdatedPayload): void {
    this.server
      .to(getSaleRoomId(payload.saleId))
      .emit(SOCKET_EVENTS.SALE_STOCK_UPDATED, payload);
  }

  /** Emit order result to the buyer's private room. Redis adapter fans out cross-instance. (FR-18) */
  sendOrderResult(result: OrderResult): void {
    this.server
      .to(getUserRoomId(result.buyerId))
      .emit(SOCKET_EVENTS.ORDER_RESULT_UPDATED, {
        saleId: result.saleId,
        status: result.status,
      } satisfies OrderResultUpdatedPayload);
  }
}
