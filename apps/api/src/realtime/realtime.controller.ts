import { Body, Controller, Post } from "@nestjs/common";
import { BroadcastDto } from "./dto/broadcast.dto.js";
import { SaleGateway } from "./sale.gateway.js";

/**
 * DEV/DEMO hook (S-E0.4b). Lets us trigger a stock broadcast over HTTP to prove
 * cross-instance fan-out for AC2: POST it on instance A, see it on a client
 * connected to instance B. The real stock broadcast will be driven by the
 * worker→api relay over Redis pub/sub (§6) in a later card; this endpoint goes away
 * then.
 */
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
