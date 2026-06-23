import { IsDateString, IsInt, IsNotEmpty, IsString, MaxLength, Min } from "class-validator";
import type { CreateSale } from "@flash-sale/shared";

export class CreateSaleDto implements CreateSale {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @IsInt()
  @Min(1)
  stockTotal!: number;

  @IsInt()
  @Min(1)
  priceCents!: number;

  @IsDateString()
  startsAt!: string;

  @IsDateString()
  endsAt!: string;
}
