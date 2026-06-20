import { Body, Controller, Post } from "@nestjs/common";
import { BroadcastDto } from "./dto/broadcast.dto.js";
import { SaleGateway } from "./sale.gateway.js";

/** Dev/demo hook — triggers a stock broadcast over HTTP to verify cross-instance fan-out. */
@Controller("realtime")
export class RealtimeController {
  constructor(private readonly gateway: SaleGateway) {}

  @Post("broadcast")
  broadcast(@Body() dto: BroadcastDto): { ok: true } {
    this.gateway.broadcastStock({
      saleId: dto.saleId,
      remainingStock: dto.remainingStock,
    });
    return { ok: true };
  }
}
