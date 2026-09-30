import { IsIn } from "class-validator";
import { FRAUD_FLAG_STATUSES, type FraudFlagStatus } from "@flash-sale/shared";

export class UpdateFraudFlagStatusDto {
  @IsIn(Object.values(FRAUD_FLAG_STATUSES))
  status!: FraudFlagStatus;
}
