import { Injectable } from "@nestjs/common";
import { deriveSaleState, type SaleDto } from "@flash-sale/shared";
import { SalesRepository } from "./sales.repository.js";

@Injectable()
export class SalesService {
  constructor(private readonly repo: SalesRepository) {}

  /**
   * Returns the SaleDto for the given id, or null if not found.
   *
   * remainingStock = stockTotal − confirmed orders (§5). Currently 0 confirmed orders
   * exist, so remainingStock equals stockTotal. This becomes meaningful after S-4.1
   * when the worker starts confirming orders.
   */
  async getSaleById(id: string): Promise<SaleDto | null> {
    const sale = await this.repo.findById(id);
    if (!sale) return null;

    const confirmed = await this.repo.countConfirmedOrders(id);
    const remainingStock = sale.stockTotal - confirmed;
    const now = new Date();

    return {
      id: sale.id,
      title: sale.title,
      state: deriveSaleState({ startsAt: sale.startsAt, endsAt: sale.endsAt, remainingStock }, now),
      remainingStock,
      startsAt: sale.startsAt.toISOString(),
      endsAt: sale.endsAt.toISOString(),
      serverNow: now.toISOString(),
    };
  }
}
