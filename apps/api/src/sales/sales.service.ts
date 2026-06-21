import { BadRequestException, Injectable } from "@nestjs/common";
import { SALE_STATES, type SaleDto } from "@flash-sale/shared";
import { SalesRepository } from "./sales.repository.js";
import { toSaleDto } from "./sales.mapper.js";
import type { CreateSaleDto } from "./dto/create-sale.dto.js";

@Injectable()
export class SalesService {
  constructor(private readonly repo: SalesRepository) {}

  async getSaleById(id: string): Promise<SaleDto | null> {
    const sale = await this.repo.findById(id);
    if (!sale) return null;
    return toSaleDto(sale, sale.stockTotal - sale._count.orders, new Date());
  }

  async createSale(dto: CreateSaleDto): Promise<SaleDto> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException("endsAt must be after startsAt");
    }
    const sale = await this.repo.create({ title: dto.title, stockTotal: dto.stockTotal, startsAt, endsAt });
    return toSaleDto(sale, sale.stockTotal, new Date());
  }

  async getAllSales(): Promise<SaleDto[]> {
    const sales = await this.repo.findAll();
    const now = new Date();
    const stateOrder = { [SALE_STATES.LIVE]: 0, [SALE_STATES.UPCOMING]: 1, [SALE_STATES.ENDED]: 2 };
    return sales
      .map((s) => toSaleDto(s, s.stockTotal - s._count.orders, now))
      .sort((a, b) => stateOrder[a.state] - stateOrder[b.state]);
  }
}
