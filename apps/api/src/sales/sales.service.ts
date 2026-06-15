import { Injectable } from "@nestjs/common";
import { SALE_STATES, type SaleDto } from "@flash-sale/shared";
import { SalesRepository } from "./sales.repository.js";
import { toSaleDto } from "./sales.mapper.js";

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
    return toSaleDto(sale, sale.stockTotal - sale._count.orders, new Date());
  }

  /** Returns all sales sorted live → upcoming → ended (FR-2, state is derived not stored). */
  async getAllSales(): Promise<SaleDto[]> {
    const sales = await this.repo.findAll();
    const now = new Date();
    const stateOrder = { [SALE_STATES.LIVE]: 0, [SALE_STATES.UPCOMING]: 1, [SALE_STATES.ENDED]: 2 };
    return sales
      .map((s) => toSaleDto(s, s.stockTotal - s._count.orders, now))
      .sort((a, b) => stateOrder[a.state] - stateOrder[b.state]);
  }
}
