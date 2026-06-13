/**
 * Cron data fetcher. Updates matches.json (+ standings/stats/injuries/forecasts) from API-Football.
 *
 * Quota-aware (paid Pro = 7,500/day):
 *  - Self-throttles: ZERO calls unless a match is in a live window or it's a setup/forced refresh.
 *  - LIVE poll: /fixtures?live=all then ONE batched /fixtures?ids=… (≤20) that returns events,
 *    lineups, statistics and player ratings embedded — so a whole round of live matches costs ~2-3 calls.
 *  - Standings are computed locally (no /standings call after setup).
 *  - Top scorers / injuries / forecasts refresh on setup and occasionally during live windows.
 *  - Hard daily ceiling (_api-usage.json) + overrides.json merged last.
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type {
  Roster, MatchesFile, Match, GoalEvent, MatchEvent, Lineup, TeamStat, PlayerRating,
  StandingsFile, StatsFile, InjuriesFile, ForecastsFile, PlayerStatLine, Forecast,
  GroupLetter,
} from "@shared/types.js";
import { MATCHES_PER_GROUP } from "@shared/constants.js";
import { computeGroupTable, type GroupResult } from "./lib/standings.js";
import { DATA_DIR, REPO_ROOT, writeJson } from "./lib/util.js";
import {
  apiGet, getRequestCount, mapStatus, mapPosition, mapEventType,
  WC_LEAGUE, WC_SEASON,
  type ApiFixture, type ApiFixtureDetailed, type ApiPlayerStat, type ApiInjury, type ApiPrediction,
} from "./lib/apiFootball.js";

const FORCE = !!process.env.FORCE || process.argv.includes("--full");
const LIVE_LEAD_MS = 10 * 60 * 1000;
const LIVE_TAIL_MS = 165 * 60 * 1000;
const DAILY_CAP = Number(process.env.API_DAILY_CAP ?? 400);
const STATS_REFRESH_MS = 20 * 60 * 1000; // refresh golden boot/injuries at most every 20 min when live
const MAX_FORECAST_FETCHES = Number(process.env.MAX_FORECAST_FETCHES ?? 12);
const USAGE_FILE = "_api-usage.json";

function load<T>(file: string, fallback: T): T {
  const path = resolve(DATA_DIR, file);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

const roster = load<Roster>("roster.json", { updatedAt: "", teams: [], players: [] });
const prev = load<MatchesFile>("matches.json", {
  updatedAt: "", tournamentComplete: false, championTeamId: null, matches: [],
});
const prevStats = load<StatsFile>("stats.json", { updatedAt: "", topScorers: [], topAssists: [], topCards: [] });
const prevInjuries = load<InjuriesFile>("injuries.json", { updatedAt: "", items: [] });
const prevForecasts = load<ForecastsFile>("forecasts.json", { updatedAt: "", items: [] });

interface OverridesFile {
  tournamentComplete?: boolean;
  championTeamId?: string | null;
  matches?: Record<string, Partial<Match>>;
}
const overridesPath = resolve(REPO_ROOT, "overrides.json");
const overrides = existsSync(overridesPath)
  ? (JSON.parse(readFileSync(overridesPath, "utf8")) as OverridesFile)
  : null;

const teamByApi = new Map<number, { id: string; group: GroupLetter }>();
for (const t of roster.teams) if (t.apiId) teamByApi.set(t.apiId, { id: t.id, group: t.group });
const playerByApi = new Map<number, string>();
for (const p of roster.players) if (p.apiId) playerByApi.set(p.apiId, p.id);
const teamName = new Map(roster.teams.map((t) => [t.id, t.name]));

const now = Date.now();
const toNum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace("%", ""));
  return Number.isFinite(n) ? n : null;
};

interface Usage { date: string; count: number }
const todayUtc = () => new Date().toISOString().slice(0, 10);
function loadUsage(): Usage {
  const u = load<Usage>(USAGE_FILE, { date: todayUtc(), count: 0 });
  return u.date === todayUtc() ? u : { date: todayUtc(), count: 0 };
}

function inLiveWindow(): boolean {
  return prev.matches.some((m) => {
    const k = Date.parse(m.kickoff);
    return now >= k - LIVE_LEAD_MS && now <= k + LIVE_TAIL_MS;
  });
}

// --- map embedded detail objects ------------------------------------------
interface Details {
  goals: GoalEvent[];
  events: MatchEvent[];
  lineups: Lineup[];
  stats: TeamStat[];
  ratings: PlayerRating[];
}
function mapDetails(f: ApiFixtureDetailed): Details {
  const events: MatchEvent[] = (f.events ?? []).map((e) => ({
    minute: e.time.elapsed, extraMinute: e.time.extra ?? null,
    teamId: teamByApi.get(e.team.id)?.id ?? "", type: mapEventType(e.type), detail: e.detail,
    playerName: e.player.name ?? "Unknown",
    playerId: e.player.id ? (playerByApi.get(e.player.id) ?? null) : null,
    assistName: e.assist?.name ?? null,
  }));
  const goals: GoalEvent[] = (f.events ?? [])
    .filter((e) => e.type.toLowerCase() === "goal" && e.detail !== "Missed Penalty")
    .map((e) => ({
      playerId: e.player.id ? (playerByApi.get(e.player.id) ?? null) : null,
      apiPlayerId: e.player.id, playerName: e.player.name ?? "Unknown",
      minute: e.time.elapsed, teamId: teamByApi.get(e.team.id)?.id ?? "",
      ownGoal: e.detail === "Own Goal",
    }));
  const lineups: Lineup[] = (f.lineups ?? []).map((l) => ({
    teamId: teamByApi.get(l.team.id)?.id ?? "", formation: l.formation, coach: l.coach?.name ?? null,
    startXI: l.startXI.map((p) => ({
      playerId: p.player.id ? (playerByApi.get(p.player.id) ?? null) : null,
      name: p.player.name, number: p.player.number, pos: p.player.pos, grid: p.player.grid,
    })),
    subs: l.substitutes.map((p) => ({
      playerId: p.player.id ? (playerByApi.get(p.player.id) ?? null) : null,
      name: p.player.name, number: p.player.number, pos: p.player.pos, grid: p.player.grid,
    })),
  }));
  const stats: TeamStat[] = (f.statistics ?? []).map((s) => ({
    teamId: teamByApi.get(s.team.id)?.id ?? "", items: s.statistics,
  }));
  const ratings: PlayerRating[] = (f.players ?? []).flatMap((tp) =>
    tp.players.map((pl) => ({
      playerId: pl.player.id ? (playerByApi.get(pl.player.id) ?? null) : null,
      name: pl.player.name, teamId: teamByApi.get(tp.team.id)?.id ?? "",
      rating: toNum(pl.statistics[0]?.games.rating), number: pl.statistics[0]?.games.number ?? null,
    })),
  );
  return { goals, events, lineups, stats, ratings };
}

function buildMatch(f: ApiFixture, id: string, details?: Details, carry?: Match): Match {
  const home = teamByApi.get(f.teams.home.id)!;
  const away = teamByApi.get(f.teams.away.id)!;
  const md = f.league.round.match(/(\d+)\s*$/);
  const status = mapStatus(f.fixture.status.short);
  const played = status === "LIVE" || status === "HT" || status === "FINISHED";
  const v = f.fixture.venue;
  return {
    id, apiId: f.fixture.id, group: home.group, matchday: md ? Number(md[1]) : 1,
    kickoff: f.fixture.date, ground: v?.name ?? null,
    venue: v?.name ? { name: v.name, city: v.city ?? null } : null,
    homeTeamId: home.id, awayTeamId: away.id, status,
    elapsed: f.fixture.status.elapsed, homeGoals: f.goals.home, awayGoals: f.goals.away,
    // rich data only for played matches; never carry it onto a (re-)scheduled fixture
    goals: played ? (details?.goals ?? carry?.goals ?? []) : [],
    events: played ? (details?.events ?? carry?.events) : undefined,
    lineups: details?.lineups ?? (played ? carry?.lineups : undefined),
    stats: played ? (details?.stats ?? carry?.stats) : undefined,
    ratings: played ? (details?.ratings ?? carry?.ratings) : undefined,
  };
}

async function fetchDetails(ids: number[]): Promise<Map<number, ApiFixtureDetailed>> {
  const map = new Map<number, ApiFixtureDetailed>();
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const res = await apiGet<ApiFixtureDetailed>("fixtures", { ids: chunk.join("-") });
    for (const f of res) map.set(f.fixture.id, f);
  }
  return map;
}

function ourMatchId(fixtures: ApiFixture[]): Map<number, string> {
  const byGroup = new Map<GroupLetter, ApiFixture[]>();
  for (const f of fixtures) {
    const home = teamByApi.get(f.teams.home.id);
    if (!home) continue;
    (byGroup.get(home.group) ?? byGroup.set(home.group, []).get(home.group)!).push(f);
  }
  const map = new Map<number, string>();
  for (const [group, fs] of byGroup) {
    fs.sort((a, b) => a.fixture.date.localeCompare(b.fixture.date) || a.fixture.id - b.fixture.id);
    fs.forEach((f, i) => map.set(f.fixture.id, `${group}-${i + 1}`));
  }
  return map;
}
const goalCount = (h: number | null, a: number | null) => (h ?? 0) + (a ?? 0);

async function fullRefresh(): Promise<Match[]> {
  console.log("  full refresh: GET /fixtures");
  const fixtures = (await apiGet<ApiFixture>("fixtures", { league: WC_LEAGUE, season: WC_SEASON }))
    .filter((f) => teamByApi.has(f.teams.home.id) && teamByApi.has(f.teams.away.id));
  const idMap = ourMatchId(fixtures);
  const prevById = new Map(prev.matches.map((m) => [m.id, m]));

  const needDetail = fixtures.filter((f) => {
    const id = idMap.get(f.fixture.id);
    const old = id ? prevById.get(id) : undefined;
    const status = mapStatus(f.fixture.status.short);
    const played = status === "LIVE" || status === "HT" || status === "FINISHED";
    const changed = !old || goalCount(old.homeGoals, old.awayGoals) !== goalCount(f.goals.home, f.goals.away) || !old.events;
    return played && changed;
  });
  const details = await fetchDetails(needDetail.map((f) => f.fixture.id));
  console.log(`  ${fixtures.length} fixtures, details for ${details.size}`);

  return fixtures
    .map((f) => {
      const id = idMap.get(f.fixture.id);
      if (!id) return null;
      const d = details.get(f.fixture.id);
      return buildMatch(f, id, d ? mapDetails(d) : undefined, prevById.get(id));
    })
    .filter((m): m is Match => m !== null);
}

async function livePoll(): Promise<Match[]> {
  console.log("  live poll: GET /fixtures?live=all");
  const live = (await apiGet<ApiFixture>("fixtures", { live: "all" })).filter((f) => f.league.id === WC_LEAGUE);

  // ongoing live + matches in window that may have just finished
  const ids = new Set<number>(live.map((f) => f.fixture.id));
  for (const m of prev.matches) {
    if (!m.apiId || m.status === "FINISHED") continue;
    const k = Date.parse(m.kickoff);
    if (now >= k - LIVE_LEAD_MS && now <= k + LIVE_TAIL_MS) ids.add(m.apiId);
  }
  if (ids.size === 0) {
    console.log("  nothing live");
    return prev.matches;
  }
  const details = await fetchDetails([...ids]);
  console.log(`  ${live.length} WC live, details for ${details.size}`);

  return prev.matches.map((m) => {
    if (!m.apiId) return m;
    const d = details.get(m.apiId);
    if (!d) return m;
    return buildMatch(d, m.id, mapDetails(d), m);
  });
}

function recomputeStandings(matches: Match[]): StandingsFile {
  const groups = [...new Set(roster.teams.map((t) => t.group))].sort();
  return {
    updatedAt: new Date().toISOString(),
    groups: groups.map((group) => {
      const gm = matches.filter((m) => m.group === group);
      const results: GroupResult[] = gm
        .filter((m) => m.status === "FINISHED" && m.homeGoals !== null && m.awayGoals !== null)
        .map((m) => ({ homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, homeGoals: m.homeGoals!, awayGoals: m.awayGoals! }));
      const teamIds = roster.teams.filter((t) => t.group === group).map((t) => t.id);
      const rows = computeGroupTable(teamIds, results, (id) => teamName.get(id) ?? id);
      const final = gm.length === MATCHES_PER_GROUP && gm.every((m) => m.status === "FINISHED");
      return { group, rows, final };
    }),
  };
}

function applyOverrides(file: MatchesFile): MatchesFile {
  if (!overrides) return file;
  if (overrides.tournamentComplete !== undefined) file.tournamentComplete = overrides.tournamentComplete;
  if (overrides.championTeamId !== undefined) file.championTeamId = overrides.championTeamId;
  if (overrides.matches) {
    const byId = new Map(file.matches.map((m) => [m.id, m]));
    for (const [id, patch] of Object.entries(overrides.matches)) {
      const m = byId.get(id);
      if (m) Object.assign(m, patch);
    }
  }
  return file;
}

// --- occasional data -------------------------------------------------------
function mapStatLine(s: ApiPlayerStat, value: number | null): PlayerStatLine {
  const st = s.statistics[0];
  const teamId = st ? teamByApi.get(st.team.id)?.id ?? null : null;
  return {
    playerId: playerByApi.get(s.player.id) ?? null, apiId: s.player.id, name: s.player.name,
    teamId, teamName: st?.team.name ?? "", photo: s.player.photo ?? null,
    position: st ? mapPosition(st.games.position) : null,
    value: value ?? 0, goals: st?.goals.total ?? 0, assists: st?.goals.assists ?? 0,
    appearances: st?.games.appearences ?? 0,
  };
}
async function refreshStats(): Promise<StatsFile> {
  const [scorers, assists, cards] = await Promise.all([
    apiGet<ApiPlayerStat>("players/topscorers", { league: WC_LEAGUE, season: WC_SEASON }),
    apiGet<ApiPlayerStat>("players/topassists", { league: WC_LEAGUE, season: WC_SEASON }),
    apiGet<ApiPlayerStat>("players/topyellowcards", { league: WC_LEAGUE, season: WC_SEASON }),
  ]);
  return {
    updatedAt: new Date().toISOString(),
    topScorers: scorers.map((s) => mapStatLine(s, s.statistics[0]?.goals.total ?? 0)),
    topAssists: assists.map((s) => mapStatLine(s, s.statistics[0]?.goals.assists ?? 0)),
    topCards: cards.map((s) => mapStatLine(s, s.statistics[0]?.cards.yellow ?? 0)),
  };
}
async function refreshInjuries(): Promise<InjuriesFile> {
  const items = await apiGet<ApiInjury>("injuries", { league: WC_LEAGUE, season: WC_SEASON });
  return {
    updatedAt: new Date().toISOString(),
    items: items.map((i) => ({
      playerId: playerByApi.get(i.player.id) ?? null, apiId: i.player.id, name: i.player.name,
      teamId: teamByApi.get(i.team.id)?.id ?? null, teamName: i.team.name, type: i.type, reason: i.reason,
    })),
  };
}
async function refreshForecasts(matches: Match[]): Promise<ForecastsFile> {
  const upcoming = matches.filter((m) => m.status === "SCHEDULED" && m.apiId).slice(0, MAX_FORECAST_FETCHES);
  const items: Forecast[] = [];
  for (const m of upcoming) {
    const res = await apiGet<ApiPrediction>("predictions", { fixture: m.apiId! });
    const p = res[0]?.predictions;
    if (!p) continue;
    const winApi = p.winner?.id ?? null;
    const winnerTeamId = winApi ? teamByApi.get(winApi)?.id ?? null : null;
    items.push({
      matchId: m.id, winnerTeamId, winnerName: p.winner?.name ?? null, advice: p.advice ?? null,
      percent: { home: toNum(p.percent.home) ?? 0, draw: toNum(p.percent.draw) ?? 0, away: toNum(p.percent.away) ?? 0 },
    });
  }
  return { updatedAt: new Date().toISOString(), items };
}
const stale = (iso: string, ms: number) => !iso || now - Date.parse(iso) > ms;

async function main() {
  if (!roster.teams.some((t) => t.apiId)) {
    console.warn("roster.json has no API ids yet — run setup / `npm run roster`. Skipping (0 requests).");
    return;
  }
  const bootstrapped = prev.matches.some((m) => m.apiId);
  const needFull = FORCE;
  const live = inLiveWindow();
  if (!needFull) {
    if (!bootstrapped) { console.log("Fixtures not bootstrapped — run setup (--full). Skipping."); return; }
    if (!live) { console.log("No match live right now — skipping (0 requests)."); return; }
  }
  const usage = loadUsage();
  if (!FORCE && usage.count >= DAILY_CAP) {
    console.warn(`Daily API cap (${DAILY_CAP}) reached — skipping.`);
    return;
  }

  console.log(`Fetching (full=${needFull}, live=${live}, used today=${usage.count}):`);
  let matches = needFull ? await fullRefresh() : await livePoll();
  matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id));

  let matchesFile: MatchesFile = {
    updatedAt: new Date().toISOString(),
    tournamentComplete: prev.tournamentComplete, championTeamId: prev.championTeamId, matches,
  };
  matchesFile = applyOverrides(matchesFile);
  writeJson("matches.json", matchesFile);
  writeJson("standings.json", recomputeStandings(matchesFile.matches));

  // occasional leaders/injuries/forecasts
  if (needFull || stale(prevStats.updatedAt, STATS_REFRESH_MS)) {
    try { writeJson("stats.json", await refreshStats()); }
    catch (e) { console.warn("  stats refresh failed:", (e as Error).message); }
  }
  if (needFull || stale(prevInjuries.updatedAt, 6 * 3600_000)) {
    try { writeJson("injuries.json", await refreshInjuries()); }
    catch (e) { console.warn("  injuries refresh failed:", (e as Error).message); }
  }
  if (needFull || stale(prevForecasts.updatedAt, 12 * 3600_000)) {
    try { writeJson("forecasts.json", await refreshForecasts(matchesFile.matches)); }
    catch (e) { console.warn("  forecasts refresh failed:", (e as Error).message); }
  }

  usage.count += getRequestCount();
  writeJson(USAGE_FILE, usage);
  console.log(`  ${getRequestCount()} requests this run; ${usage.count}/${DAILY_CAP} used today.`);
}

main().catch((e) => {
  console.error("fetch-data failed:", e.message);
  process.exit(1);
});
