import { IsInt, IsOptional, IsPositive, IsString, IsUUID, Matches, MaxLength, Min } from "class-validator";

/** Input for POST /orders (FR-7, NFR-9). The client is never trusted — every field is validated. */
export class CreateOrderDto {
  @IsUUID()
  saleId!: string;

  /** Temporary until S-2.5 replaces this with the auth token subject. */
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: "buyerId may contain only letters, digits, '-' and '_'",
  })
  buyerId!: string;

  @IsInt()
  @IsPositive()
  @Min(1)
  quantity!: number;

  /** FR-12 [Ext]: Stripe PaymentMethod token from the frontend. Optional — absent in fake-payment mode. */
  @IsOptional()
  @IsString()
  @Matches(/^pm_[A-Za-z0-9]+$/, { message: "paymentMethodId must be a valid Stripe PaymentMethod id" })
  paymentMethodId?: string;
}
