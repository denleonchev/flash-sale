import { IsString, IsUUID, Matches, MaxLength } from "class-validator";

export class AbandonCheckoutDto {
  @IsUUID()
  saleId!: string;

  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9_-]+$/)
  buyerId!: string;
}
