import { Controller, Get, NotFoundException, Param, ParseUUIDPipe } from "@nestjs/common";
import type { SaleDto } from "@flash-sale/shared";
import { SalesService } from "./sales.service.js";

@Controller("sales")
export class SalesController {
  constructor(private readonly service: SalesService) {}

  /** FR-5: returns the sale with derived state + remaining stock. */
  @Get(":id")
  async getSale(@Param("id", ParseUUIDPipe) id: string): Promise<SaleDto> {
    const sale = await this.service.getSaleById(id);
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return sale;
  }
}
