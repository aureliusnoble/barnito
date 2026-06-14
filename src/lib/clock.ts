import { useEffect, useState } from "react";

/** Re-render on an interval (only while `active`) so live clocks can tick. */
export function useTick(active: boolean, ms = 12000): void {
  const [, setN] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setN((n) => n + 1), ms);
    return () => window.clearInterval(id);
  }, [active, ms]);
}

/**
 * Live match minute. The API gives `elapsed` but we only snapshot it every cron run, so we tick it
 * forward in the browser from the moment the data was written. Capped at the current half (45'+ / 90'+)
 * so it can't run away if a snapshot is old; the next snapshot re-anchors it.
 */
export function liveMinute(elapsed: number | null, dataUpdatedAt: string): string {
  if (elapsed == null) return "LIVE";
  const t = Date.parse(dataUpdatedAt);
  const sinceMin = Number.isFinite(t) ? Math.max(0, (Date.now() - t) / 60000) : 0;
  const cap = elapsed <= 45 ? 45 : 90;
  const m = Math.floor(Math.min(elapsed + sinceMin, cap));
  return m >= cap ? `${cap}+'` : `${m}'`;
}
