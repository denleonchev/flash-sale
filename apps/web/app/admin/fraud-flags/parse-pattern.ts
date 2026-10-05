// Field order and names mirror FraudScreeningService.buildPattern in the worker, which
// stores the pattern as "attempts: 5, confirmed: 1, ...".
export const PATTERN_FIELDS = [
  { key: "attempts", label: "Attempts" },
  { key: "confirmed", label: "Confirmed" },
  { key: "sold_out", label: "Sold out" },
  { key: "failed", label: "Failed" },
  { key: "time_window_minutes", label: "Window, min" },
  { key: "account_age_hours", label: "Account age, h" },
] as const;

type PatternKey = (typeof PATTERN_FIELDS)[number]["key"];
export type PatternValues = Record<PatternKey, number>;

// Returns null when the text is not in the expected shape (the format may change one
// day while old flags keep the old text); the caller then shows the raw pattern.
export function parsePattern(pattern: string): PatternValues | null {
  const entries = new Map(
    pattern.split(",").map((part) => {
      const [key, value] = part.split(":");
      return [key?.trim(), Number(value)] as const;
    }),
  );

  const values: Partial<PatternValues> = {};
  for (const { key } of PATTERN_FIELDS) {
    const value = entries.get(key);
    if (value === undefined || Number.isNaN(value)) return null;
    values[key] = value;
  }
  return values as PatternValues;
}
