import { Body, Controller, Get, NotFoundException, Param, ParseUUIDPipe, Post } from "@nestjs/common";
import type { Sale } from "@flash-sale/shared";
import { SalesService } from "./sales.service.js";
import { CreateSaleDto } from "./dto/create-sale.dto.js";

@Controller("sales")
export class SalesController {
  constructor(private readonly service: SalesService) {}

  // TODO NFR-7: restrict to admin role
  @Post()
  createSale(@Body() dto: CreateSaleDto): Promise<Sale> {
    return this.service.createSale(dto);
  }

  // TODO NFR-7: restrict to admin role
  @Post(":id/end")
  endSale(@Param("id", ParseUUIDPipe) id: string): Promise<Sale> {
    return this.service.endSale(id);
  }

  /** Catalog: all sales sorted live → upcoming → ended (supports FR-5 / UR-1). */
  @Get()
  getAllSales(): Promise<Sale[]> {
    return this.service.getAllSales();
  }

  /** FR-5: returns the sale with derived state + remaining stock. */
  @Get(":id")
  async getSale(@Param("id", ParseUUIDPipe) id: string): Promise<Sale> {
    const sale = await this.service.getSaleById(id);
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return sale;
  }
}
