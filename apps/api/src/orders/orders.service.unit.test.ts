import { ConflictException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { SALE_STATES } from "@flash-sale/shared";
import { OrdersService } from "./orders.service.js";

function makeService(getSaleById: () => unknown): OrdersService {
  return new OrdersService(
    {} as never, // OrderProducer — not reached on rejection
    {} as never, // OrderResultPublisher — not reached on rejection
    {} as never, // StockService — not reached on rejection
    { getSaleById } as never,
    {} as never, // OrdersRepository — not reached on rejection
  );
}

const dto = { saleId: "sale-1", buyerId: "buyer-1", quantity: 1 };

describe("OrdersService.buy — live guard (FR-3)", () => {
  it("rejects when sale does not exist", async () => {
    const service = makeService(() => null);
    await expect(service.buy(dto as never)).rejects.toThrow(
      new ConflictException("sale not found"),
    );
  });

  it("rejects with 'sale not started yet' when upcoming", async () => {
    const service = makeService(() => ({ state: SALE_STATES.UPCOMING }));
    await expect(service.buy(dto as never)).rejects.toThrow(
      new ConflictException("sale not started yet"),
    );
  });

  it("rejects with 'sale has ended' when ended", async () => {
    const service = makeService(() => ({ state: SALE_STATES.ENDED }));
    await expect(service.buy(dto as never)).rejects.toThrow(
      new ConflictException("sale has ended"),
    );
  });
});
