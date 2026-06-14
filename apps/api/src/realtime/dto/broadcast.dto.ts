import { IsInt, IsString, MaxLength, Min } from "class-validator";

/**
 * Body of the dev broadcast endpoint. Validated like any client input (NFR-9),
 * even though the endpoint is only a demo trigger for AC2.
 */
export class BroadcastDto {
  @IsString()
  @MaxLength(64)
  saleId!: string;

  @IsInt()
  @Min(0)
  remainingStock!: number;
}
