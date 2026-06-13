// Thin API-Football (api-sports.io v3) client. Docs: https://www.api-football.com/documentation-v3
// Auth via the x-apisports-key header. World Cup 2026 = league 1, season 2026.

const BASE = process.env.API_FOOTBALL_BASE ?? "https://v3.football.api-sports.io";
export const WC_LEAGUE = Number(process.env.API_FOOTBALL_LEAGUE ?? 1);
export const WC_SEASON = Number(process.env.API_FOOTBALL_SEASON ?? 2026);

export interface ApiResponse<T> {
  get: string;
  errors: unknown;
  results: number;
  paging: { current: number; total: number };
  response: T[];
}

let requestCount = 0;
export const getRequestCount = () => requestCount;

// Free tier rate-limits per minute; space requests out and back off on 429.
const MIN_INTERVAL_MS = Number(process.env.API_FOOTBALL_MIN_INTERVAL_MS ?? 1500);
const MAX_RETRIES = 4;
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function apiGetRaw<T>(path: string, params: Record<string, string | number>): Promise<ApiResponse<T>> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  for (let attempt = 0; ; attempt++) {
    const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    requestCount++;

    const res = await fetch(url, { headers: { "x-apisports-key": key } });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get("retry-after")) || 60;
      console.warn(`  rate-limited (429) on ${path}; waiting ${retryAfter}s…`);
      await sleep(retryAfter * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`API ${path} -> HTTP ${res.status}`);
    const body = (await res.json()) as ApiResponse<T>;
    const errors = body.errors;
    const hasErrors =
      errors &&
      ((Array.isArray(errors) && errors.length) ||
        (typeof errors === "object" && Object.keys(errors as object).length));
    if (hasErrors) {
      // API often signals rate limits via the errors object rather than a 429 status.
      const txt = JSON.stringify(errors);
      if (/rate|limit|requests/i.test(txt) && attempt < MAX_RETRIES) {
        console.warn(`  API rate message on ${path}: ${txt}; waiting 60s…`);
        await sleep(60_000);
        continue;
      }
      throw new Error(`API ${path} errors: ${txt}`);
    }
    return body;
  }
}

export async function apiGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  return (await apiGetRaw<T>(path, params)).response ?? [];
}

/** Fetch every page of a paginated endpoint (used for /players). */
export async function apiGetAllPages<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const first = await apiGetRaw<T>(path, { ...params, page: 1 });
  const all = [...first.response];
  for (let page = 2; page <= first.paging.total; page++) {
    const next = await apiGetRaw<T>(path, { ...params, page });
    all.push(...next.response);
  }
  return all;
}

// --- response shapes we use ------------------------------------------------

export interface ApiTeamEntry {
  team: { id: number; name: string; code?: string | null; logo: string };
  venue?: { name: string | null; city: string | null; capacity?: number | null; image?: string | null };
}

export interface ApiStandingRow {
  rank: number;
  team: { id: number; name: string; logo: string };
  points: number;
  goalsDiff: number;
  group: string; // e.g. "Group A"
  all: { played: number; win: number; draw: number; lose: number; goals: { for: number; against: number } };
}

export interface ApiPlayerEntry {
  player: { id: number; name: string; firstname: string; lastname: string; photo: string; position?: string };
  statistics: { games: { position: string | null } }[];
}

export interface ApiFixture {
  fixture: {
    id: number;
    date: string;
    status: { short: string; elapsed: number | null };
    venue: { name: string | null; city?: string | null };
  };
  league: { id: number; round: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
}

export interface ApiEvent {
  time: { elapsed: number | null; extra?: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  assist?: { id: number | null; name: string | null };
  type: string; // "Goal", "Card", "subst", "Var"
  detail: string; // "Normal Goal", "Own Goal", "Penalty", "Missed Penalty", "Yellow Card", ...
}

export interface ApiLineupPlayer {
  player: { id: number | null; name: string; number: number | null; pos: string | null; grid: string | null };
}
export interface ApiLineup {
  team: { id: number; name: string };
  formation: string | null;
  startXI: ApiLineupPlayer[];
  substitutes: ApiLineupPlayer[];
  coach?: { id: number; name: string } | null;
}
export interface ApiStatistics {
  team: { id: number };
  statistics: { type: string; value: string | number | null }[];
}
export interface ApiFixturePlayers {
  team: { id: number };
  players: {
    player: { id: number; name: string };
    statistics: { games: { number: number | null; position: string | null; rating: string | null } }[];
  }[];
}

/** /fixtures?ids=... returns the base fixture plus these embedded objects. */
export interface ApiFixtureDetailed extends ApiFixture {
  events?: ApiEvent[];
  lineups?: ApiLineup[];
  statistics?: ApiStatistics[];
  players?: ApiFixturePlayers[];
}

// top scorers / assists / cards: /players/topscorers etc.
export interface ApiPlayerStat {
  player: { id: number; name: string; photo: string };
  statistics: {
    team: { id: number; name: string };
    goals: { total: number | null; assists: number | null };
    games: { position: string | null; appearences: number | null };
    cards: { yellow: number | null; red: number | null };
  }[];
}

export interface ApiInjury {
  player: { id: number; name: string };
  team: { id: number; name: string };
  type: string;
  reason: string;
}

export interface ApiPrediction {
  predictions: {
    winner: { id: number | null; name: string | null } | null;
    advice: string | null;
    percent: { home: string; draw: string; away: string };
  };
  teams: { home: { id: number }; away: { id: number } };
}

export function mapEventType(t: string): "GOAL" | "CARD" | "SUBST" | "VAR" {
  const s = t.toLowerCase();
  if (s === "goal") return "GOAL";
  if (s === "card") return "CARD";
  if (s === "subst") return "SUBST";
  return "VAR";
}

/** Map API-Football position strings to our four buckets. */
export function mapPosition(pos: string | null | undefined): "GK" | "DEF" | "MID" | "FWD" {
  switch ((pos ?? "").toLowerCase()) {
    case "goalkeeper":
    case "g":
      return "GK";
    case "defender":
    case "d":
      return "DEF";
    case "midfielder":
    case "m":
      return "MID";
    case "attacker":
    case "f":
      return "FWD";
    default:
      return "FWD";
  }
}

/** Map an API fixture status to our MatchStatus. */
export function mapStatus(short: string): "SCHEDULED" | "LIVE" | "HT" | "FINISHED" {
  if (["1H", "2H", "ET", "BT", "P", "LIVE"].includes(short)) return "LIVE";
  if (short === "HT") return "HT";
  if (["FT", "AET", "PEN"].includes(short)) return "FINISHED";
  return "SCHEDULED";
}

/** Extract the group letter from an API "round" or "group" string. */
export function groupLetterFrom(s: string): string | null {
  const m = s.match(/Group\s+([A-L])/i);
  return m ? m[1].toUpperCase() : null;
}
