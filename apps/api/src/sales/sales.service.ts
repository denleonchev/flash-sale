import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { SALE_STATES, type Sale, type CreateSale } from "@flash-sale/shared";
import { EmbedSaleProducer } from "../embeds/embed-sale.producer.js";
import { EmbeddingService } from "../embeds/embedding.service.js";
import { SalesRepository } from "./sales.repository.js";
import { toSale } from "./sales.mapper.js";

@Injectable()
export class SalesService {
  constructor(
    private readonly repo: SalesRepository,
    private readonly embedProducer: EmbedSaleProducer,
    private readonly embeddingService: EmbeddingService,
  ) {}

  async getSaleById(id: string): Promise<Sale | null> {
    const sale = await this.repo.findById(id);
    if (!sale) return null;
    return toSale(sale, sale.stockTotal - sale._count.orders, new Date());
  }

  async createSale(dto: CreateSale): Promise<Sale> {
    const startsAt = new Date(dto.startsAt);
    const endsAt = new Date(dto.endsAt);
    if (endsAt <= startsAt) {
      throw new BadRequestException("endsAt must be after startsAt");
    }
    const sale = await this.repo.create({ title: dto.title, description: dto.description, stockTotal: dto.stockTotal, priceCents: dto.priceCents, startsAt, endsAt });
    // FR-26, NFR-14: fire-and-forget — embedding runs in the background, never blocks the response.
    void this.embedProducer.enqueueEmbedSale(sale.id, sale.title, sale.description ?? undefined);
    return toSale(sale, sale.stockTotal, new Date());
  }

  async endSale(id: string): Promise<Sale> {
    const existing = await this.repo.findById(id);
    if (!existing) throw new NotFoundException(`Sale ${id} not found`);
    const sale = await this.repo.endNow(id);
    return toSale(sale, existing.stockTotal - existing._count.orders, new Date());
  }

  async searchSales(query: string): Promise<Sale[]> {
    const vector = await this.embeddingService.embed(query);
    const sales = await this.repo.searchByEmbedding(vector);
    const now = new Date();
    return sales.map((s) => toSale(s, s.stockTotal - s._count.orders, now));
  }

  async getAllSales(): Promise<Sale[]> {
    const sales = await this.repo.findAll();
    const now = new Date();
    const stateOrder = { [SALE_STATES.LIVE]: 0, [SALE_STATES.UPCOMING]: 1, [SALE_STATES.ENDED]: 2 };
    return sales
      .map((s) => toSale(s, s.stockTotal - s._count.orders, now))
      .sort((a, b) => stateOrder[a.state] - stateOrder[b.state]);
  }
}
