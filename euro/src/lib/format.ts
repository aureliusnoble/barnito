// Formatting helpers — one voice for numbers, odds, probabilities, dates.

export const fmtPts = (n: number): string =>
  (n < 0 ? "−" : "") + Math.abs(Math.round(n)).toLocaleString("en-GB");

export const fmtSignedPts = (n: number): string => (n > 0 ? "+" : "") + fmtPts(n);

export const fmtOdds = (o: number): string => o.toFixed(2);

export const fmtProb = (p: number): string => `${Math.round(p * 100)}%`;

export const fmtDay = (iso: string): string =>
  new Date(iso).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "Europe/London" });

export const fmtTime = (iso: string): string =>
  new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" });

export const fmtFull = (iso: string): string => `${fmtDay(iso)} · ${fmtTime(iso)} UK`;

/** "in 3d 4h" / "in 2h 10m" / "kicked off" relative to a supplied now. */
export function relKickoff(iso: string, nowMs: number): string {
  const d = Date.parse(iso) - nowMs;
  if (d <= 0) return "kicked off";
  const mins = Math.floor(d / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `in ${hours}h ${mins % 60}m`;
  return `in ${Math.floor(hours / 24)}d ${hours % 24}h`;
}
