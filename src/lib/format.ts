// Team name → ISO 3166-1 alpha-2, for flag emoji. Covers the 48 group teams.
const ISO2: Record<string, string> = {
  "Czech Republic": "CZ", Mexico: "MX", "South Africa": "ZA", "South Korea": "KR",
  "Bosnia & Herzegovina": "BA", Canada: "CA", Qatar: "QA", Switzerland: "CH",
  Brazil: "BR", Haiti: "HT", Morocco: "MA", Scotland: "GB-SCT", Australia: "AU",
  Paraguay: "PY", Turkey: "TR", USA: "US", "Curaçao": "CW", Ecuador: "EC",
  Germany: "DE", "Ivory Coast": "CI", Japan: "JP", Netherlands: "NL", Sweden: "SE",
  Tunisia: "TN", Belgium: "BE", Egypt: "EG", Iran: "IR", "New Zealand": "NZ",
  "Cape Verde": "CV", "Saudi Arabia": "SA", Spain: "ES", Uruguay: "UY", France: "FR",
  Iraq: "IQ", Norway: "NO", Senegal: "SN", Algeria: "DZ", Argentina: "AR",
  Austria: "AT", Jordan: "JO", Colombia: "CO", "DR Congo": "CD", Portugal: "PT",
  Uzbekistan: "UZ", Croatia: "HR", England: "GB-ENG", Ghana: "GH", Panama: "PA",
};

const SUBDIVISION_FLAGS: Record<string, string> = {
  "GB-ENG": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
  "GB-SCT": "🏴󠁧󠁢󠁳󠁣󠁴󠁿",
};

export function flagEmoji(teamName: string): string {
  const code = ISO2[teamName];
  if (!code) return "⚽";
  if (SUBDIVISION_FLAGS[code]) return SUBDIVISION_FLAGS[code];
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

export function sameUtcDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

const timeFmt = new Intl.DateTimeFormat(undefined, {
  hour: "2-digit",
  minute: "2-digit",
});
const dayFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const fullFmt = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const formatDay = (iso: string) => dayFmt.format(new Date(iso));
export const formatFull = (iso: string) => fullFmt.format(new Date(iso));

export function relativeKickoff(iso: string, now: Date = new Date()): string {
  const diffMs = new Date(iso).getTime() - now.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < -1) return "started";
  if (mins < 60) return `in ${Math.max(mins, 0)}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

// London (Europe/London, BST-aware) offset from UTC, in ms, at a given instant.
function londonOffsetMs(at: number): number {
  const p = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(at));
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - at;
}

/** Instant of **noon UK on the day after today (UK)** — the upper bound of "today's" matches, so
 *  late North-American kickoffs (early-AM UK) still count as today. */
export function ukSlateCutoffMs(now: number = Date.now()): number {
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now));
  const g = (t: string) => Number(p.find((x) => x.type === t)!.value);
  const guess = Date.UTC(g("year"), g("month") - 1, g("day") + 1, 12, 0, 0); // tomorrow 12:00 as if UTC
  return guess - londonOffsetMs(guess);
}

/** The "football day" a kickoff belongs to (YYYY-MM-DD), where a day runs from 12:00 noon UK to
 *  noon the next day — so an early-AM UK kickoff is grouped under the previous calendar day.
 *  Computed as the UK date of the instant 12h before kickoff. */
export function footballDayKey(iso: string): string {
  const shifted = new Date(Date.parse(iso) - 12 * 3600_000);
  const p = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(shifted);
  const g = (t: string) => p.find((x) => x.type === t)!.value;
  return `${g("year")}-${g("month")}-${g("day")}`;
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export const POSITION_LABEL: Record<string, string> = {
  GK: "Goalkeeper",
  DEF: "Defender",
  MID: "Midfielder",
  FWD: "Forward",
};
