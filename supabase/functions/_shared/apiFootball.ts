// API-Football (api-sports.io v3) client for Deno edge functions. World Cup 2026 = league 1, season 2026.
const BASE = "https://v3.football.api-sports.io";
export const WC_LEAGUE = 1;
export const WC_SEASON = 2026;

const MIN_INTERVAL_MS = 1200;
let lastAt = 0;
let count = 0;
export const requestCount = () => count;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface ApiResponse<T> {
  errors: unknown;
  results: number;
  paging: { current: number; total: number };
  response: T[];
}

async function raw<T>(path: string, params: Record<string, string | number>): Promise<ApiResponse<T>> {
  const key = Deno.env.get("API_FOOTBALL_KEY");
  if (!key) throw new Error("API_FOOTBALL_KEY not set");
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 0; ; attempt++) {
    const wait = lastAt + MIN_INTERVAL_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastAt = Date.now();
    count++;
    const res = await fetch(url, { headers: { "x-apisports-key": key } });
    if (res.status === 429 && attempt < 3) {
      await sleep((Number(res.headers.get("retry-after")) || 30) * 1000);
      continue;
    }
    if (!res.ok) throw new Error(`API ${path} -> HTTP ${res.status}`);
    const body = (await res.json()) as ApiResponse<T>;
    const e = body.errors;
    const hasErr = e && ((Array.isArray(e) && e.length) || (typeof e === "object" && Object.keys(e as object).length));
    if (hasErr) {
      const txt = JSON.stringify(e);
      if (/rate|limit|requests/i.test(txt) && attempt < 3) { await sleep(30000); continue; }
      throw new Error(`API ${path} errors: ${txt}`);
    }
    return body;
  }
}

export async function apiGet<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  return (await raw<T>(path, params)).response ?? [];
}
export async function apiGetAllPages<T>(path: string, params: Record<string, string | number> = {}): Promise<T[]> {
  const first = await raw<T>(path, { ...params, page: 1 });
  const all = [...first.response];
  for (let p = 2; p <= first.paging.total; p++) all.push(...(await raw<T>(path, { ...params, page: p })).response);
  return all;
}

// --- response shapes -------------------------------------------------------
export interface ApiTeamEntry {
  team: { id: number; name: string; code?: string | null; logo: string };
  venue?: { name: string | null; city: string | null; capacity?: number | null; image?: string | null };
}
export interface ApiStandingRow {
  rank: number; group: string; points: number; goalsDiff: number;
  team: { id: number; name: string; logo: string };
}
export interface ApiPlayerEntry {
  player: { id: number; name: string; photo: string; position?: string };
  statistics: { games: { position: string | null; number?: number | null } }[];
}
export interface ApiFixture {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null }; venue: { name: string | null; city?: string | null } };
  league: { id: number; name?: string; round: string };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
}
export interface ApiEvent {
  time: { elapsed: number | null; extra?: number | null };
  team: { id: number; name: string };
  player: { id: number | null; name: string | null };
  assist?: { id: number | null; name: string | null };
  type: string; detail: string;
}
export interface ApiLineup {
  team: { id: number; name: string }; formation: string | null;
  startXI: { player: { id: number | null; name: string; number: number | null; pos: string | null; grid: string | null } }[];
  substitutes: { player: { id: number | null; name: string; number: number | null; pos: string | null; grid: string | null } }[];
  coach?: { id: number; name: string } | null;
}
export interface ApiStatistics { team: { id: number }; statistics: { type: string; value: string | number | null }[] }
export interface ApiFixturePlayerStat {
  games: { number: number | null; position: string | null; rating: string | null; minutes: number | null; captain: boolean | null };
  shots: { total: number | null; on: number | null };
  goals: { total: number | null; conceded: number | null; assists: number | null; saves: number | null };
  passes: { total: number | null; key: number | null; accuracy: string | number | null };
  tackles: { total: number | null; blocks: number | null; interceptions: number | null };
  duels: { total: number | null; won: number | null };
  dribbles: { attempts: number | null; success: number | null; past: number | null };
  fouls: { drawn: number | null; committed: number | null };
  cards: { yellow: number | null; red: number | null };
  penalty: { won: number | null; commited: number | null; scored: number | null; missed: number | null; saved: number | null };
}
export interface ApiFixturePlayers {
  team: { id: number };
  players: { player: { id: number; name: string }; statistics: ApiFixturePlayerStat[] }[];
}
export interface ApiFixtureDetailed extends ApiFixture {
  events?: ApiEvent[]; lineups?: ApiLineup[]; statistics?: ApiStatistics[]; players?: ApiFixturePlayers[];
}
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
  player: { id: number; name: string }; team: { id: number; name: string }; type: string; reason: string;
}

// --- mappers ---------------------------------------------------------------
export function mapPosition(pos: string | null | undefined): "GK" | "DEF" | "MID" | "FWD" {
  switch ((pos ?? "").toLowerCase()) {
    case "goalkeeper": case "g": return "GK";
    case "defender": case "d": return "DEF";
    case "midfielder": case "m": return "MID";
    case "attacker": case "f": return "FWD";
    default: return "FWD";
  }
}
export function mapStatus(short: string): "SCHEDULED" | "LIVE" | "HT" | "FINISHED" {
  if (["1H", "2H", "ET", "BT", "P", "LIVE"].includes(short)) return "LIVE";
  if (short === "HT") return "HT";
  if (["FT", "AET", "PEN"].includes(short)) return "FINISHED";
  return "SCHEDULED";
}
export function mapEventType(t: string): "GOAL" | "CARD" | "SUBST" | "VAR" {
  const s = t.toLowerCase();
  if (s === "goal") return "GOAL";
  if (s === "card") return "CARD";
  if (s === "subst") return "SUBST";
  return "VAR";
}
export function groupLetterFrom(s: string): string | null {
  const m = s.match(/Group\s+([A-L])/i);
  return m ? m[1].toUpperCase() : null;
}
export const GOAL_MULTIPLIER: Record<string, number> = { GK: 32, DEF: 32, MID: 16, FWD: 8 };
