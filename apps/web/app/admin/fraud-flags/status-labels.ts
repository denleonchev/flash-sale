import { FRAUD_FLAG_STATUSES, type FraudFlagStatus } from "@flash-sale/shared";

export const FRAUD_FLAG_STATUS_LABELS: Record<FraudFlagStatus, string> = {
  [FRAUD_FLAG_STATUSES.OPEN]: "Open",
  [FRAUD_FLAG_STATUSES.CONFIRMED]: "Confirmed",
  [FRAUD_FLAG_STATUSES.REJECTED]: "Rejected",
};
