"use client";

import { useEffect, useState } from "react";
import { formatDuration } from "./format-duration";

/**
 * Live countdown to a target time. Anchored to the **server** clock: at mount we
 * measure the skew between the server's `serverNow` and the local clock, then tick on
 * estimated server time — so the display does not depend on the visitor's wrong clock.
 * No socket here; real-time pushes are UR-3. When it reaches zero it just stops (the
 * state flips on the next page load).
 */
const TICK_INTERVAL_MS = 1000;

export function Countdown({
  targetAt,
  serverNow,
}: {
  targetAt: string;
  serverNow: string;
}) {
  const targetMs = new Date(targetAt).getTime();
  const [remainingMs, setRemainingMs] = useState(
    () => targetMs - new Date(serverNow).getTime(),
  );

  useEffect(() => {
    // Offset between server clock and local clock — lets us track server time
    // without trusting the visitor's clock.
    const clockSkewMs = new Date(serverNow).getTime() - Date.now();
    const updateRemaining = () => setRemainingMs(targetMs - (Date.now() + clockSkewMs));
    updateRemaining();
    const timerId = setInterval(updateRemaining, TICK_INTERVAL_MS);
    return () => clearInterval(timerId);
  }, [targetMs, serverNow]);

  return <time dateTime={targetAt}>{formatDuration(remainingMs)}</time>;
}
