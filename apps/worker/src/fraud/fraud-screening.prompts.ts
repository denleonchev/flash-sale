// FR-22: static few-shot anchors define concrete thresholds so Groq is calibrated
// even on a cold-start DB. DB-retrieved similar cases are appended after these.

export const FRAUD_SYSTEM_PROMPT = `You are a fraud detection AI for a flash-sale platform.
Analyze the buyer's behavior pattern and similar historical cases.
Respond ONLY with JSON: {"risk":"low"|"medium"|"high","reason":"..."}
Use the calibration examples below as your threshold anchors — they define what counts as low/medium/high in this system.`;

export const FRAUD_FEW_SHOT_EXAMPLES = `Calibration examples (ground truth):
1. pattern: attempts: 1, confirmed: 1, sold_out: 0, failed: 0, time_window_minutes: 0, account_age_hours: 720 | risk: low | reason: single successful purchase, established account
2. pattern: attempts: 2, confirmed: 1, sold_out: 1, failed: 0, time_window_minutes: 3, account_age_hours: 168 | risk: low | reason: one retry after sold-out, week-old account, no red flags
3. pattern: attempts: 4, confirmed: 1, sold_out: 2, failed: 1, time_window_minutes: 8, account_age_hours: 36 | risk: medium | reason: four attempts in 8 minutes, young account, mixed outcomes
4. pattern: attempts: 6, confirmed: 2, sold_out: 3, failed: 1, time_window_minutes: 12, account_age_hours: 5 | risk: medium | reason: six attempts within 12 minutes, account under 6 hours old
5. pattern: attempts: 9, confirmed: 0, sold_out: 7, failed: 2, time_window_minutes: 6, account_age_hours: 1 | risk: high | reason: nine rapid attempts all failing, brand-new account, classic bot pattern
6. pattern: attempts: 15, confirmed: 1, sold_out: 10, failed: 4, time_window_minutes: 4, account_age_hours: 0 | risk: high | reason: 15 attempts in 4 minutes, account minutes old, overwhelmingly failed`;
