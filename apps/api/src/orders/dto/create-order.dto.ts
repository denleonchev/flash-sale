import { IsInt, IsPositive, IsString, Matches, MaxLength } from "class-validator";

/**
 * Input for the placeholder Buy endpoint (S-E0.4a). The client is never trusted
 * (NFR-9): every field is validated before we touch the queue. The real flow adds
 * auth and reservation in a later card; the shape mirrors `OrderJobPayload`.
 */
export class CreateOrderDto {
  @IsString()
  @MaxLength(64)
  saleId!: string;

  @IsString()
  @MaxLength(64)
  buyerId!: string;

  /**
   * Stable per buyer+sale; reused verbatim as the BullMQ job id for idempotency
   * (FR-14). BullMQ forbids ':' in custom job ids, so we restrict the key to
   * url-safe chars and reject anything else with a clean 400 instead of letting
   * BullMQ throw a 500 at enqueue time.
   */
  @IsString()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: "idempotencyKey may contain only letters, digits, '-' and '_'",
  })
  idempotencyKey!: string;

  @IsInt()
  @IsPositive()
  quantity!: number;
}
