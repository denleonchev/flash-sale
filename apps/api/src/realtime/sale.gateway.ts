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

/** `cors.origin: true` only matters in dev (no nginx). (NFR-10) */
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
   * Snapshot NOT pushed here — saleId is unknown at connect time; pushed on
   * (re)subscribe instead. (FR-19)
   *
   * Socket joins the private room BEFORE any Buy click → no race between
   * "result published" and "room joined". (FR-18)
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

  // Snapshot on (re)subscribe so client never shows stale data. (FR-17, FR-19)
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

  // Suppress future reconnect snapshots once buyer has seen their result. (FR-19)
  @SubscribeMessage(SOCKET_EVENTS.ORDER_RESULT_UNSUBSCRIBE)
  async handleOrderResultUnsubscribe(
    @MessageBody() data: { orderId?: unknown },
    @ConnectedSocket() socket: Socket,
  ): Promise<void> {
    const buyerId = socket.data.buyerId as string | undefined;
    if (!buyerId || typeof data?.orderId !== "string" || !data.orderId) return;
    await this.ordersService.acknowledgeOrderResult(data.orderId);
  }

  broadcastStock(payload: SaleStockUpdatedPayload): void {
    this.server.to(getSaleRoomId(payload.saleId)).emit(SOCKET_EVENTS.SALE_STOCK_UPDATED, payload);
  }

  sendOrderResult(result: OrderResult): void {
    this.server.to(getUserRoomId(result.buyerId)).emit(SOCKET_EVENTS.ORDER_RESULT_UPDATED, {
      orderId: result.orderId,
      saleId: result.saleId,
      status: result.status,
    } satisfies OrderResultUpdatedPayload);
  }
}
