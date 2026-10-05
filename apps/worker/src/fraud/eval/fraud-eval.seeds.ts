import { RISK_LEVELS, type RiskLevel } from "@flash-sale/shared";

export interface ConfirmedFlagSeed {
  pattern: string;
  risk: RiskLevel;
  reason: string;
}

export const CONFIRMED_FLAG_SEEDS: ConfirmedFlagSeed[] = [
  {
    pattern:
      "attempts: 1, confirmed: 1, sold_out: 0, failed: 0, time_window_minutes: 0, account_age_hours: 500",
    risk: RISK_LEVELS.LOW,
    reason: "single successful purchase, established account",
  },
  {
    pattern:
      "attempts: 2, confirmed: 1, sold_out: 1, failed: 0, time_window_minutes: 25, account_age_hours: 800",
    risk: RISK_LEVELS.LOW,
    reason: "two unhurried attempts, month-old account",
  },
  {
    pattern:
      "attempts: 5, confirmed: 1, sold_out: 3, failed: 1, time_window_minutes: 9, account_age_hours: 20",
    risk: RISK_LEVELS.MEDIUM,
    reason: "five attempts in 9 minutes, account under a day old",
  },
  {
    pattern:
      "attempts: 6, confirmed: 2, sold_out: 3, failed: 1, time_window_minutes: 15, account_age_hours: 8",
    risk: RISK_LEVELS.MEDIUM,
    reason: "six attempts in 15 minutes, young account, mixed outcomes",
  },
  {
    pattern:
      "attempts: 14, confirmed: 0, sold_out: 12, failed: 2, time_window_minutes: 4, account_age_hours: 0",
    risk: RISK_LEVELS.HIGH,
    reason: "14 rapid attempts with no success, brand-new account",
  },
  {
    pattern:
      "attempts: 18, confirmed: 1, sold_out: 14, failed: 3, time_window_minutes: 5, account_age_hours: 1",
    risk: RISK_LEVELS.HIGH,
    reason: "18 attempts in 5 minutes, hour-old account, bot-like",
  },
];
