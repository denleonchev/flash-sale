import { RISK_LEVELS, type RiskLevel } from "@flash-sale/shared";
import type { BuyerActivity } from "../fraud-flags.repository.js";

export interface FraudEvalCase {
  name: string;
  activity: BuyerActivity;
  expected: RiskLevel;
}

export const FRAUD_EVAL_CASES: FraudEvalCase[] = [
  {
    name: "single purchase, old account",
    activity: {
      attempts: 1,
      confirmed: 1,
      sold_out: 0,
      failed: 0,
      time_window_minutes: 0,
      account_age_hours: 2000,
    },
    expected: RISK_LEVELS.LOW,
  },
  {
    name: "single sold-out, old account",
    activity: {
      attempts: 1,
      confirmed: 0,
      sold_out: 1,
      failed: 0,
      time_window_minutes: 0,
      account_age_hours: 400,
    },
    expected: RISK_LEVELS.LOW,
  },
  {
    name: "two purchases in 15 minutes",
    activity: {
      attempts: 2,
      confirmed: 2,
      sold_out: 0,
      failed: 0,
      time_window_minutes: 15,
      account_age_hours: 1200,
    },
    expected: RISK_LEVELS.LOW,
  },
  {
    name: "three attempts over 40 minutes",
    activity: {
      attempts: 3,
      confirmed: 1,
      sold_out: 2,
      failed: 0,
      time_window_minutes: 40,
      account_age_hours: 900,
    },
    expected: RISK_LEVELS.LOW,
  },
  {
    name: "new account, single purchase",
    activity: {
      attempts: 1,
      confirmed: 1,
      sold_out: 0,
      failed: 0,
      time_window_minutes: 0,
      account_age_hours: 0,
    },
    expected: RISK_LEVELS.LOW,
  },
  {
    name: "five attempts in 10 minutes, day-old account",
    activity: {
      attempts: 5,
      confirmed: 1,
      sold_out: 3,
      failed: 1,
      time_window_minutes: 10,
      account_age_hours: 24,
    },
    expected: RISK_LEVELS.MEDIUM,
  },
  {
    name: "four attempts, none successful",
    activity: {
      attempts: 4,
      confirmed: 0,
      sold_out: 3,
      failed: 1,
      time_window_minutes: 6,
      account_age_hours: 48,
    },
    expected: RISK_LEVELS.MEDIUM,
  },
  {
    name: "six attempts in 20 minutes",
    activity: {
      attempts: 6,
      confirmed: 1,
      sold_out: 4,
      failed: 1,
      time_window_minutes: 20,
      account_age_hours: 10,
    },
    expected: RISK_LEVELS.MEDIUM,
  },
  {
    name: "burst on an established account",
    activity: {
      attempts: 5,
      confirmed: 2,
      sold_out: 2,
      failed: 1,
      time_window_minutes: 5,
      account_age_hours: 300,
    },
    expected: RISK_LEVELS.MEDIUM,
  },
  {
    name: "seven attempts in 30 minutes, 3-hour-old account",
    activity: {
      attempts: 7,
      confirmed: 2,
      sold_out: 4,
      failed: 1,
      time_window_minutes: 30,
      account_age_hours: 3,
    },
    expected: RISK_LEVELS.MEDIUM,
  },
  {
    name: "12 attempts in 5 minutes, new account",
    activity: {
      attempts: 12,
      confirmed: 0,
      sold_out: 10,
      failed: 2,
      time_window_minutes: 5,
      account_age_hours: 0,
    },
    expected: RISK_LEVELS.HIGH,
  },
  {
    name: "20 attempts in 3 minutes",
    activity: {
      attempts: 20,
      confirmed: 1,
      sold_out: 15,
      failed: 4,
      time_window_minutes: 3,
      account_age_hours: 1,
    },
    expected: RISK_LEVELS.HIGH,
  },
  {
    name: "10 attempts in 2 minutes, all missed",
    activity: {
      attempts: 10,
      confirmed: 0,
      sold_out: 8,
      failed: 2,
      time_window_minutes: 2,
      account_age_hours: 2,
    },
    expected: RISK_LEVELS.HIGH,
  },
  {
    name: "30 attempts in 10 minutes",
    activity: {
      attempts: 30,
      confirmed: 2,
      sold_out: 25,
      failed: 3,
      time_window_minutes: 10,
      account_age_hours: 0,
    },
    expected: RISK_LEVELS.HIGH,
  },
  {
    name: "11 attempts in 4 minutes, 60-hour-old account",
    activity: {
      attempts: 11,
      confirmed: 1,
      sold_out: 9,
      failed: 1,
      time_window_minutes: 4,
      account_age_hours: 60,
    },
    expected: RISK_LEVELS.HIGH,
  },
];
