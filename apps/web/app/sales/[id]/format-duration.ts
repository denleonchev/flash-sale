const SECONDS_IN_MINUTE = 60;
const SECONDS_IN_HOUR = 60 * SECONDS_IN_MINUTE;
const SECONDS_IN_DAY = 24 * SECONDS_IN_HOUR;
const MS_IN_SECOND = 1000;

export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / MS_IN_SECOND));
  const days = Math.floor(totalSeconds / SECONDS_IN_DAY);
  const hours = Math.floor((totalSeconds % SECONDS_IN_DAY) / SECONDS_IN_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_IN_HOUR) / SECONDS_IN_MINUTE);
  const seconds = totalSeconds % SECONDS_IN_MINUTE;
  const padTwo = (n: number) => String(n).padStart(2, "0");
  const hoursMinutesSeconds = `${padTwo(hours)}:${padTwo(minutes)}:${padTwo(seconds)}`;
  return days > 0 ? `${days}d ${hoursMinutesSeconds}` : hoursMinutesSeconds;
}
