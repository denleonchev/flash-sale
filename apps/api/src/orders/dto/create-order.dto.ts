import {
  IsEmail,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

/** Input for POST /orders (FR-7, NFR-9). The client is never trusted — every field is validated. */
export class CreateOrderDto {
  @IsUUID()
  saleId!: string;

  // buyerId = base64url(Auth0 sub), set by web BFF from session (S-2.5, NFR-9).
  // Kept in the body so S-E0.5 load harness can send synthetic ids without auth.
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/, {
    message: "buyerId may contain only letters, digits, '-' and '_'",
  })
  buyerId!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  @MaxLength(128)
  name?: string;

  @IsInt()
  @IsPositive()
  @Min(1)
  quantity!: number;

  @IsString()
  @Matches(/^pm_[A-Za-z0-9]+$/, {
    message: "paymentMethodId must be a valid Stripe PaymentMethod id",
  })
  paymentMethodId!: string;
}
