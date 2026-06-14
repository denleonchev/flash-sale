"use client";

import { useEffect, useState } from "react";

/**
 * Live countdown to a target time. Anchored to the **server** clock: at mount we
 * measure the skew between the server's `serverNow` and the local clock, then tick on
 * estimated server time — so the display does not depend on the visitor's wrong clock.
 * No socket here; real-time pushes are UR-3. When it reaches zero it just stops (the
 * state flips on the next page load).
 */
function format(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  const hms = `${pad(h)}:${pad(m)}:${pad(s)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}

export function Countdown({
  targetIso,
  serverNowIso,
}: {
  targetIso: string;
  serverNowIso: string;
}) {
  const target = new Date(targetIso).getTime();
  const [remaining, setRemaining] = useState(
    () => target - new Date(serverNowIso).getTime(),
  );

  useEffect(() => {
    // serverNow ≈ localStart + skew → estimate server "now" without trusting the client clock.
    const skew = new Date(serverNowIso).getTime() - Date.now();
    const tick = () => setRemaining(target - (Date.now() + skew));
    tick();
    const handle = setInterval(tick, 1000);
    return () => clearInterval(handle);
  }, [target, serverNowIso]);

  return <time dateTime={targetIso}>{format(remaining)}</time>;
}
