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

export async function apiGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));

  requestCount++;
  const res = await fetch(url, { headers: { "x-apisports-key": key } });
  if (!res.ok) throw new Error(`API ${path} -> HTTP ${res.status}`);
  const body = (await res.json()) as ApiResponse<T>;
  const errors = body.errors;
  if (errors && ((Array.isArray(errors) && errors.length) || (typeof errors === "object" && Object.keys(errors as object).length))) {
    throw new Error(`API ${path} errors: ${JSON.stringify(errors)}`);
  }
  return body.response ?? [];
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

async function apiGetRaw<T>(path: string, params: Record<string, string | number>): Promise<ApiResponse<T>> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("API_FOOTBALL_KEY is not set");
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  requestCount++;
  const res = await fetch(url, { headers: { "x-apisports-key": key } });
  if (!res.ok) throw new Error(`API ${path} -> HTTP ${res.status}`);
  return (await res.json()) as ApiResponse<T>;
}

// --- response shapes we use ------------------------------------------------

export interface ApiTeamEntry {
  team: { id: number; name: string; logo: string };
  group?: string;
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
    venue: { name: string | null };
  };
  league: { id: number; round: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
}

export interface ApiEvent {
  time: { elapsed: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  type: string; // "Goal", "Card", "subst"
  detail: string; // "Normal Goal", "Own Goal", "Penalty", "Missed Penalty"
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
