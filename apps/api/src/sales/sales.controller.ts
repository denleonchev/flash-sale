import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import type { Sale } from "@flash-sale/shared";
import { AdminGuard } from "../admin/admin.guard.js";
import { SalesService } from "./sales.service.js";
import { SalesAiService, type ImprovedSaleCopy } from "./sales.ai.service.js";
import { CreateSaleDto } from "./dto/create-sale.dto.js";
import { ImproveSaleCopyDto } from "./dto/improve-sale-copy.dto.js";

@Controller("sales")
export class SalesController {
  constructor(
    private readonly service: SalesService,
    private readonly aiService: SalesAiService,
  ) {}

  @UseGuards(AdminGuard)
  @Post()
  createSale(@Body() dto: CreateSaleDto): Promise<Sale> {
    return this.service.createSale(dto);
  }

  @UseGuards(AdminGuard)
  @Post("improve-copy")
  improveCopy(@Body() dto: ImproveSaleCopyDto): Promise<ImprovedSaleCopy> {
    return this.aiService.improveSaleCopy(dto.title, dto.description ?? "");
  }

  @UseGuards(AdminGuard)
  @Post(":id/end")
  endSale(@Param("id", ParseUUIDPipe) id: string): Promise<Sale> {
    return this.service.endSale(id);
  }

  /** Catalog: all sales sorted live → upcoming → ended (supports FR-5 / UR-1). */
  @Get()
  getAllSales(): Promise<Sale[]> {
    return this.service.getAllSales();
  }

  /** FR-26: semantic search via pgvector cosine distance. */
  @Get("search")
  searchSales(@Query("q") q: string): Promise<Sale[]> {
    if (!q || q.trim().length === 0) throw new BadRequestException("q must be a non-empty string");
    return this.service.searchSales(q.trim());
  }

  /** FR-5: returns the sale with derived state + remaining stock. */
  @Get(":id")
  async getSale(@Param("id", ParseUUIDPipe) id: string): Promise<Sale> {
    const sale = await this.service.getSaleById(id);
    if (!sale) throw new NotFoundException(`Sale ${id} not found`);
    return sale;
  }
}
