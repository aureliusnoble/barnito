// Barnito ingester + scorer. Runs on a pg_cron schedule (~30s). Self-throttles:
//  - every run: poll live fixtures (cheap) and update them with embedded events/lineups/stats/ratings
//  - every ~5 min (or first run): reconcile ALL fixtures so finished games always transition and no
//    fixture is ever dropped (the two production bugs)
//  - recompute scores/standings/playerStats and append score_history
// Query modes: ?mode=roster (one-off: teams+players+fifa), ?mode=full (force a reconcile).
import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  apiGet, apiGetAllPages, requestCount, requestsRemaining, mapStatus, mapPosition, mapEventType, groupLetterFrom,
  GOAL_MULTIPLIER, WC_LEAGUE, WC_SEASON,
  type ApiFixture, type ApiFixtureDetailed, type ApiStandingRow, type ApiTeamEntry,
  type ApiPlayerEntry, type ApiPlayerStat, type ApiInjury, type ApiLineup,
} from "../_shared/apiFootball.ts";
import { computeScores } from "../_shared/scoring.ts";
import { computeGroupTable, type GroupResult } from "../_shared/standings.ts";
import type {
  Team, Player, Match, GoalEvent, MatchEvent, Lineup, TeamStat, PlayerRating, GroupLetter,
  Participant, StandingsFile,
} from "../_shared/types.ts";
import { MATCHES_PER_GROUP } from "../_shared/constants.ts";
import { FIFA_RANKS } from "../_shared/fifaRanks.ts";

const FULL_INTERVAL_MS = 5 * 60 * 1000;
const IDLE_FULL_INTERVAL_MS = 30 * 60 * 1000; // when no match is live/imminent, reconcile far less often
const STATS_INTERVAL_MS = 20 * 60 * 1000;
const STALE_LIVE_MS = 3 * 60 * 60 * 1000;
const FINALIZE_STALE_MS = 4 * 60 * 60 * 1000; // a match still "live" this long after KO → feed stuck; finalize

const supa = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

// PostgREST caps a single response at 1000 rows, but the players table is ~2300 rows. Page through
// the whole table so player matching (events, scorers, lineups) and scoring see every player.
async function selectAll(table: string, columns = "*"): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supa.from(table).select(columns).range(from, from + size - 1);
    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
async function getMeta() {
  const { data } = await supa.from("documents").select("data").eq("key", "_meta").maybeSingle();
  return (data?.data ?? {}) as { lastFull?: string; lastStats?: string; squadCursor?: number; leagueCursor?: number; uclSeasonIdx?: number; uclPage?: number; wcSeasonIdx?: number; wcPage?: number; uclSeason2?: number; uclPage2?: number; histCursor?: number };
}
async function setDoc(key: string, data: unknown) {
  await supa.from("documents").upsert({ key, data, updated_at: new Date().toISOString() });
}

function rowToMatch(r: Record<string, unknown>): Match {
  return {
    id: r.id as string, apiId: (r.api_id as number) ?? null, group: (r.group_letter as GroupLetter) ?? ("?" as GroupLetter),
    matchday: (r.matchday as number) ?? 1, kickoff: r.kickoff as string, ground: (r.ground as string) ?? null,
    venue: (r.venue as Match["venue"]) ?? null, homeTeamId: r.home_team_id as string, awayTeamId: r.away_team_id as string,
    status: r.status as Match["status"], elapsed: (r.elapsed as number) ?? null,
    homeGoals: (r.home_goals as number) ?? null, awayGoals: (r.away_goals as number) ?? null,
    penHome: (r.pen_home as number) ?? null, penAway: (r.pen_away as number) ?? null,
    goals: (r.goals as GoalEvent[]) ?? [], events: (r.events as MatchEvent[]) ?? undefined,
    lineups: (r.lineups as Lineup[]) ?? undefined, stats: (r.stats as TeamStat[]) ?? undefined,
    ratings: (r.ratings as PlayerRating[]) ?? undefined, h2h: (r.h2h as Match["h2h"]) ?? undefined,
    weather: (r.weather as Match["weather"]) ?? null,
    phase: (r.phase as Match["phase"]) ?? undefined,
  };
}
function matchToRow(m: Match, round?: string) {
  return {
    id: m.id, api_id: m.apiId, group_letter: m.group === "?" ? null : m.group, matchday: m.matchday,
    kickoff: m.kickoff, status: m.status, elapsed: m.elapsed, home_team_id: m.homeTeamId,
    away_team_id: m.awayTeamId, home_goals: m.homeGoals, away_goals: m.awayGoals, ground: m.ground,
    pen_home: m.penHome ?? null, pen_away: m.penAway ?? null,
    venue: m.venue, goals: m.goals, events: m.events ?? null, lineups: m.lineups ?? null,
    stats: m.stats ?? null, ratings: m.ratings ?? null, h2h: m.h2h ?? null, round: round ?? null,
    weather: m.weather ?? null, phase: m.phase ?? null, updated_at: new Date().toISOString(),
  };
}
// Meaningful fields (everything but the always-changing updated_at and the cosmetic round), used to
// skip re-writing unchanged match rows — otherwise every tick rewrites all 88 rows and fires a
// realtime message per row to every connected client, which alone can blow the egress quota.
const MATCH_SIG_KEYS = [
  "api_id", "group_letter", "matchday", "kickoff", "status", "elapsed", "home_team_id", "away_team_id",
  "home_goals", "away_goals", "pen_home", "pen_away", "ground", "venue", "goals", "events", "lineups", "stats", "ratings", "h2h", "weather", "phase",
] as const;
// deno-lint-ignore no-explicit-any
const sigNorm = (v: any) => (v == null || (Array.isArray(v) && v.length === 0) ? null : v); // []/null/undefined all equal
// deno-lint-ignore no-explicit-any
const matchSig = (r: Record<string, any>) => JSON.stringify(MATCH_SIG_KEYS.map((k) => sigNorm(r[k])));

// ---------------------------------------------------------------------------
// lookup state from DB
async function loadState() {
  const [teams, players, participants, matches] = await Promise.all([
    selectAll("teams"),
    selectAll("players"),
    selectAll("participants"),
    selectAll("matches"),
  ]);
  const teamByApi = new Map<number, { id: string; group: GroupLetter | null }>();
  for (const t of teams ?? []) if (t.api_id) teamByApi.set(t.api_id, { id: t.id, group: t.group_letter });
  const playerByApi = new Map<number, string>();
  for (const p of players ?? []) if (p.api_id) playerByApi.set(p.api_id, p.id);
  return {
    teams: (teams ?? []) as Record<string, unknown>[],
    players: (players ?? []) as Record<string, unknown>[],
    participants: (participants ?? []) as Record<string, unknown>[],
    matchRows: (matches ?? []) as Record<string, unknown>[],
    teamByApi, playerByApi,
  };
}

type State = Awaited<ReturnType<typeof loadState>>;

/** Map API lineups → our Lineup[] (shared by the embedded payload and the dedicated endpoint). */
function mapLineups(apiLineups: ApiLineup[] | undefined, st: State): Lineup[] {
  const tid = (id: number) => st.teamByApi.get(id)?.id ?? "";
  const pid = (id: number | null) => (id ? st.playerByApi.get(id) ?? null : null);
  return (apiLineups ?? []).map((l) => ({
    teamId: tid(l.team.id), formation: l.formation, coach: l.coach?.name ?? null,
    startXI: l.startXI.map((p) => ({ playerId: pid(p.player.id), name: p.player.name, number: p.player.number, pos: p.player.pos, grid: p.player.grid })),
    subs: l.substitutes.map((p) => ({ playerId: pid(p.player.id), name: p.player.name, number: p.player.number, pos: p.player.pos, grid: p.player.grid })),
  }));
}

function mapDetails(f: ApiFixtureDetailed, st: State) {
  const tid = (id: number) => st.teamByApi.get(id)?.id ?? "";
  const pid = (id: number | null) => (id ? st.playerByApi.get(id) ?? null : null);
  const events: MatchEvent[] = (f.events ?? []).map((e) => ({
    minute: e.time.elapsed, extraMinute: e.time.extra ?? null, teamId: tid(e.team.id),
    type: mapEventType(e.type), detail: e.detail, playerName: e.player.name ?? "Unknown",
    playerId: pid(e.player.id), assistName: e.assist?.name ?? null,
  }));
  const goals: GoalEvent[] = (f.events ?? []).filter((e) => e.type.toLowerCase() === "goal" && e.detail !== "Missed Penalty")
    .map((e) => ({ playerId: pid(e.player.id), apiPlayerId: e.player.id, playerName: e.player.name ?? "Unknown",
      minute: e.time.elapsed, teamId: tid(e.team.id), ownGoal: e.detail === "Own Goal" }));
  const lineups: Lineup[] = mapLineups(f.lineups, st);
  const stats: TeamStat[] = (f.statistics ?? []).map((s) => ({ teamId: tid(s.team.id), items: s.statistics }));
  const num = (v: string | number | null | undefined) => (v == null ? null : Number(v));
  const ratings: PlayerRating[] = (f.players ?? []).flatMap((tp) => tp.players.map((pl) => {
    const x = pl.statistics[0];
    return {
      playerId: pid(pl.player.id), name: pl.player.name, teamId: tid(tp.team.id),
      rating: x?.games.rating ? Number(x.games.rating) : null,
      number: x?.games.number ?? null,
      minutes: x?.games.minutes ?? null, captain: x?.games.captain ?? false,
      goals: x?.goals.total ?? 0, assists: x?.goals.assists ?? 0,
      shotsTotal: x?.shots.total ?? 0, shotsOn: x?.shots.on ?? 0,
      passes: x?.passes.total ?? 0, passAcc: num(x?.passes.accuracy), keyPasses: x?.passes.key ?? 0,
      tackles: x?.tackles.total ?? 0, interceptions: x?.tackles.interceptions ?? 0,
      duelsTotal: x?.duels.total ?? 0, duelsWon: x?.duels.won ?? 0,
      dribbleAtt: x?.dribbles.attempts ?? 0, dribbleSucc: x?.dribbles.success ?? 0,
      foulsCommitted: x?.fouls.committed ?? 0, foulsDrawn: x?.fouls.drawn ?? 0,
      yellow: x?.cards.yellow ?? 0, red: x?.cards.red ?? 0,
      penScored: x?.penalty.scored ?? 0, penMissed: x?.penalty.missed ?? 0,
      penWon: x?.penalty.won ?? 0, penCommitted: x?.penalty.commited ?? 0, penSaved: x?.penalty.saved ?? 0,
    };
  }));
  return { goals, events, lineups, stats, ratings };
}

function buildMatch(f: ApiFixture, id: string, st: State, details?: ReturnType<typeof mapDetails>, carry?: Match, phase?: Match["phase"]): Match {
  const home = st.teamByApi.get(f.teams.home.id);
  const away = st.teamByApi.get(f.teams.away.id);
  const md = f.league.round.match(/(\d+)\s*$/);
  const status = mapStatus(f.fixture.status.short);
  const played = status === "LIVE" || status === "HT" || status === "FINISHED";
  const v = f.fixture.venue;
  return {
    id, apiId: f.fixture.id, phase, group: (phase ? "?" : home?.group ?? "?") as GroupLetter, matchday: md ? Number(md[1]) : 1,
    kickoff: f.fixture.date, ground: v?.name ?? null, venue: v?.name ? { name: v.name, city: v.city ?? null } : null,
    homeTeamId: home?.id ?? slug(f.teams.home.name), awayTeamId: away?.id ?? slug(f.teams.away.name),
    status, elapsed: f.fixture.status.elapsed, homeGoals: f.goals.home, awayGoals: f.goals.away,
    penHome: f.score?.penalty?.home ?? null, penAway: f.score?.penalty?.away ?? null,
    goals: played ? (details?.goals ?? carry?.goals ?? []) : [],
    events: played ? (details?.events ?? carry?.events) : undefined,
    lineups: details?.lineups ?? (played ? carry?.lineups : undefined),
    stats: played ? (details?.stats ?? carry?.stats) : undefined,
    ratings: played ? (details?.ratings ?? carry?.ratings) : undefined,
    h2h: carry?.h2h, // preserved; fetched separately (historical)
    weather: carry?.weather ?? null, // preserved; refreshed by refreshWeather()
  };
}

// --- weather (Open-Meteo, free, no key) ------------------------------------
const geoCache = new Map<string, { lat: number; lon: number } | null>();
async function geocode(name: string): Promise<{ lat: number; lon: number } | null> {
  if (geoCache.has(name)) return geoCache.get(name)!;
  let res: { lat: number; lon: number } | null = null;
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(name)}&count=1`);
    const g = (await r.json())?.results?.[0];
    if (g) res = { lat: g.latitude, lon: g.longitude };
  } catch (_) { /* ignore */ }
  geoCache.set(name, res);
  return res;
}
type W = { temp: number; humidity: number; code: number; wind: number };
async function currentWeather(lat: number, lon: number): Promise<W | null> {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&timezone=UTC`);
  const c = (await r.json())?.current;
  if (!c) return null;
  return { temp: Math.round(c.temperature_2m), humidity: Math.round(c.relative_humidity_2m), code: c.weather_code, wind: Math.round(c.wind_speed_10m) };
}
async function weatherAt(lat: number, lon: number, kickoff: string): Promise<W | null> {
  const d = new Date(kickoff);
  if (isNaN(d.getTime())) return null;
  const date = d.toISOString().slice(0, 10);
  const hour = d.toISOString().slice(0, 13) + ":00"; // YYYY-MM-DDTHH:00 (UTC)
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&start_date=${date}&end_date=${date}&timezone=UTC`);
  const h = (await r.json())?.hourly;
  if (!h?.time) return null;
  let i = h.time.indexOf(hour);
  if (i < 0) i = Math.min(h.time.length - 1, d.getUTCHours());
  if (i < 0) return null;
  return { temp: Math.round(h.temperature_2m[i]), humidity: Math.round(h.relative_humidity_2m[i]), code: h.weather_code[i], wind: Math.round(h.wind_speed_10m[i]) };
}
const WEATHER_FRESH_MS = 15 * 60 * 1000; // live refresh cadence
const FORECAST_FRESH_MS = 60 * 60 * 1000; // pre-match forecast refresh cadence
const FORECAST_WINDOW_MS = 24 * 60 * 60 * 1000; // start forecasting 24h before kickoff
async function refreshWeather(updated: Map<string, Match>) {
  const now = Date.now();
  for (const m of updated.values()) {
    const place = m.venue?.city || m.venue?.name;
    if (!place) continue;
    const live = m.status === "LIVE" || m.status === "HT";
    const toKo = Date.parse(m.kickoff) - now;
    const fresh = (ms: number) => m.weather && now - Date.parse(m.weather.at) < ms;

    // Decide what to fetch: a pre-match forecast, the current reading, or the frozen kickoff reading.
    let mode: "forecast" | "current" | "observed" | null = null;
    if (live) {
      if (!(m.weather && !m.weather.forecast && fresh(WEATHER_FRESH_MS))) mode = "current";
    } else if (m.status === "SCHEDULED") {
      if (toKo <= FORECAST_WINDOW_MS && toKo > -60 * 60_000 && !fresh(FORECAST_FRESH_MS)) mode = "forecast";
    } else if (m.status === "FINISHED") {
      if (!m.weather || m.weather.forecast) mode = "observed"; // upgrade a forecast to the actual kickoff reading, then freeze
    }
    if (!mode) continue;

    try {
      const coords = m.weather?.coords ?? (await geocode(place));
      if (!coords) continue;
      const w = mode === "current" ? await currentWeather(coords.lat, coords.lon) : await weatherAt(coords.lat, coords.lon, m.kickoff);
      if (w) { m.weather = { ...w, coords, at: new Date().toISOString(), forecast: mode === "forecast" }; updated.set(m.id, m); }
    } catch (_) { /* non-fatal */ }
  }
}

async function fetchDetails(ids: number[], st: State) {
  const map = new Map<number, ReturnType<typeof mapDetails>>();
  for (let i = 0; i < ids.length; i += 20) {
    const chunk = ids.slice(i, i + 20);
    const res = await apiGet<ApiFixtureDetailed>("fixtures", { ids: chunk.join("-") });
    for (const f of res) map.set(f.fixture.id, mapDetails(f, st));
  }
  return map;
}

function groupIds(fixtures: ApiFixture[], st: State): Map<number, { id: string; group: GroupLetter | null }> {
  // group-stage fixtures get stable ids "<Group>-<n>" by kickoff order; non-group → bracket only
  const byGroup = new Map<string, ApiFixture[]>();
  const out = new Map<number, { id: string; group: GroupLetter | null }>();
  for (const f of fixtures) {
    if (!/^Group/i.test(f.league.round)) continue;
    const g = st.teamByApi.get(f.teams.home.id)?.group ?? st.teamByApi.get(f.teams.away.id)?.group ?? null;
    const key = g ?? `x-${f.fixture.id}`;
    (byGroup.get(key) ?? byGroup.set(key, []).get(key)!).push(f);
  }
  for (const [key, fs] of byGroup) {
    if (key.startsWith("x-")) { for (const f of fs) out.set(f.fixture.id, { id: `x-${f.fixture.id}`, group: null }); continue; }
    fs.sort((a, b) => a.fixture.date.localeCompare(b.fixture.date) || a.fixture.id - b.fixture.id);
    fs.forEach((f, i) => out.set(f.fixture.id, { id: `${key}-${i + 1}`, group: key as GroupLetter }));
  }
  return out;
}

// API round name → scoring phase ("none" = ingested but not scored, i.e. the 3rd-place match).
const KO_PHASE: Record<string, Match["phase"]> = {
  "Round of 32": "r32", "Round of 16": "r16", "Quarter-finals": "qf", "Semi-finals": "sf", "Final": "final", "3rd Place Final": "none",
};
// Knockout match ids, ONLY once both teams are confirmed (drawn) — placeholder/TBD ties are skipped.
// Keyed by the fixture's api id so the id is stable as the bracket fills in (numbering by position
// shifts as fixtures appear and would collide with the api_id unique constraint).
function knockoutIds(fixtures: ApiFixture[], st: State): Map<number, { id: string; phase: Match["phase"] }> {
  const out = new Map<number, { id: string; phase: Match["phase"] }>();
  for (const f of fixtures) {
    const ph = KO_PHASE[f.league.round];
    if (ph === undefined) continue; // group stage or unknown round
    if (!st.teamByApi.get(f.teams.home.id) || !st.teamByApi.get(f.teams.away.id)) continue; // not drawn yet
    out.set(f.fixture.id, { id: `${ph ?? "ko"}-${f.fixture.id}`, phase: ph });
  }
  return out;
}

// ---------------------------------------------------------------------------
async function reconcileTeams(standings: ApiStandingRow[][], fixtures: ApiFixture[]) {
  const rows = new Map<number, { id: string; api_id: number; name: string; group_letter: string | null }>();
  for (const group of standings) for (const r of group) {
    const letter = groupLetterFrom(r.group);
    // The API returns a phantom "Group Stage" aggregate (no letter) alongside the real A–L groups;
    // skip it so it can't overwrite a team's real group with null.
    if (!letter) continue;
    rows.set(r.team.id, { id: slug(r.team.name), api_id: r.team.id, name: r.team.name, group_letter: letter });
  }
  // never drop a fixture: ensure both teams exist even if not in standings
  for (const f of fixtures) for (const t of [f.teams.home, f.teams.away]) {
    if (!rows.has(t.id)) rows.set(t.id, { id: slug(t.name), api_id: t.id, name: t.name, group_letter: null });
  }
  const upserts = [...rows.values()].map((t) => ({ ...t, fifa_rank: FIFA_RANKS[t.id] ?? null, updated_at: new Date().toISOString() }));
  if (upserts.length) await supa.from("teams").upsert(upserts, { onConflict: "api_id" });
}

function buildBracket(fixtures: ApiFixture[], st: State) {
  const order: Record<string, number> = { "Round of 32": 1, "Round of 16": 2, "Quarter-finals": 3, "Semi-finals": 4, "3rd Place Final": 5, Final: 6 };
  const byRound = new Map<string, unknown[]>();
  for (const f of fixtures) {
    if (/^Group/i.test(f.league.round)) continue;
    const home = st.teamByApi.get(f.teams.home.id);
    const away = st.teamByApi.get(f.teams.away.id);
    const bm = {
      apiId: f.fixture.id, round: f.league.round, kickoff: f.fixture.date, ground: f.fixture.venue?.name ?? null,
      homeTeamId: home?.id ?? null, awayTeamId: away?.id ?? null,
      homeName: home ? null : f.teams.home.name, awayName: away ? null : f.teams.away.name,
      status: mapStatus(f.fixture.status.short), homeGoals: f.goals.home, awayGoals: f.goals.away,
    };
    (byRound.get(f.league.round) ?? byRound.set(f.league.round, []).get(f.league.round)!).push(bm);
  }
  const rounds = [...byRound.entries()].map(([name, matches]) => ({ name, order: order[name] ?? 99, matches }))
    .sort((a, b) => a.order - b.order);
  return { updatedAt: new Date().toISOString(), rounds };
}

// ---------------------------------------------------------------------------
async function recomputeAndStore(st: State, matchRows: Record<string, unknown>[]) {
  const teamName = new Map((st.teams).map((t) => [t.id as string, t.name as string]));
  const fifaRankByTeam = new Map((st.teams).map((t) => [t.id as string, (t.fifa_rank as number) ?? 999]));
  const teams: Team[] = st.teams.map((t) => ({
    id: t.id as string, name: t.name as string, code: (t.code as string) ?? null, group: (t.group_letter as GroupLetter) ?? ("?" as GroupLetter),
    apiId: (t.api_id as number) ?? null, logo: (t.logo as string) ?? null, venue: (t.venue as Team["venue"]) ?? null,
  }));
  const players: Player[] = st.players.map((p) => ({
    id: p.id as string, apiId: (p.api_id as number) ?? null, name: p.name as string, teamId: p.team_id as string,
    position: (p.position as Player["position"]) ?? "FWD", goalMultiplier: (p.goal_multiplier as Player["goalMultiplier"]) ?? 8,
    photo: (p.photo as string) ?? null, number: (p.number as number) ?? null,
  }));
  const matches: Match[] = matchRows.map(rowToMatch);
  const participants: Participant[] = st.participants.map((p) => ({
    id: p.id as string, name: p.name as string, matchScores: (p.match_scores as Participant["matchScores"]) ?? [],
    topPlayers: (p.top_players as string[]) ?? [], scorersByRound: (p.scorers_by_round as Participant["scorersByRound"]) ?? undefined,
    champion: (p.champion as string) ?? "",
  }));

  // standings (actual) computed locally from finished matches
  const groups = [...new Set(teams.map((t) => t.group).filter((g) => g !== "?"))].sort();
  const groupOf = new Map(teams.map((t) => [t.id, t.group] as const));
  const buildStandings = (ms: Match[]): StandingsFile => ({
    updatedAt: new Date().toISOString(),
    groups: groups.map((group) => {
      // A true group-stage game has BOTH teams in this group and no knockout phase. A knockout tie
      // can carry a stale group_letter (and even a null phase), so identify group games by team
      // membership — bulletproof against mis-tagged rows that would otherwise block the lock.
      const gm = ms.filter((m) => !m.phase && groupOf.get(m.homeTeamId) === group && groupOf.get(m.awayTeamId) === group);
      const results: GroupResult[] = gm.filter((m) => m.status === "FINISHED" && m.homeGoals !== null && m.awayGoals !== null)
        .map((m) => ({ homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, homeGoals: m.homeGoals!, awayGoals: m.awayGoals! }));
      const teamIds = teams.filter((t) => t.group === group).map((t) => t.id);
      const rows = computeGroupTable(teamIds, results, (id) => teamName.get(id) ?? id, (id) => fifaRankByTeam.get(id) ?? 999);
      const final = gm.length === MATCHES_PER_GROUP && gm.every((m) => m.status === "FINISHED");
      return { group, rows, final };
    }),
  });
  const standings = buildStandings(matches);

  const scores = computeScores({
    roster: { updatedAt: "", teams, players },
    matches: { updatedAt: "", tournamentComplete: false, championTeamId: null, matches },
    predictions: { updatedAt: "", participants },
    standings,
  });

  // progression: each participant's cumulative total after each finished match (in kickoff order),
  // by re-scoring with only the first i finished matches counted. Powers the points-over-matches chart.
  const finished = matches
    .filter((m) => m.status === "FINISHED" && m.homeGoals !== null && m.awayGoals !== null)
    .sort((a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? "") || a.id.localeCompare(b.id));
  const neutral = (m: Match): Match => ({ ...m, status: "SCHEDULED", elapsed: null, homeGoals: null, awayGoals: null, goals: [], events: undefined, ratings: undefined });
  const totals: Record<string, number[]> = {};
  for (const p of participants) totals[p.id] = [];
  const steps: { n: number; matchId: string; kickoff: string }[] = [];
  for (let i = 1; i <= finished.length; i++) {
    const allow = new Set(finished.slice(0, i).map((m) => m.id));
    const subset = matches.map((m) => (allow.has(m.id) ? m : neutral(m)));
    const subSc = computeScores({
      roster: { updatedAt: "", teams, players },
      matches: { updatedAt: "", tournamentComplete: false, championTeamId: null, matches: subset },
      predictions: { updatedAt: "", participants },
      standings: buildStandings(subset),
    });
    const byId = new Map(subSc.leaderboard.map((e) => [e.participantId, e.total]));
    for (const p of participants) totals[p.id].push(byId.get(p.id) ?? 0);
    steps.push({ n: i, matchId: finished[i - 1].id, kickoff: finished[i - 1].kickoff });
  }

  // playerStats: goals + cards + appearances aggregated from events (FINISHED + live)
  type PS = { goals: number; yellow: number; red: number; apps: number; assists: number; penScored: number; penMissed: number; penWon: number; penCommitted: number; penSaved: number };
  const blank = (): PS => ({ goals: 0, yellow: 0, red: 0, apps: 0, assists: 0, penScored: 0, penMissed: 0, penWon: 0, penCommitted: 0, penSaved: 0 });
  const ps: Record<string, PS> = {};
  const seenApp: Record<string, Set<string>> = {};
  for (const m of matches) {
    for (const e of m.events ?? []) {
      if (!e.playerId) continue;
      ps[e.playerId] ??= blank();
      if (e.type === "GOAL" && !/own|missed/i.test(e.detail)) ps[e.playerId].goals++; // exclude own goals + missed penalties
      if (e.type === "CARD" && /yellow/i.test(e.detail)) ps[e.playerId].yellow++;
      if (e.type === "CARD" && /red/i.test(e.detail)) ps[e.playerId].red++;
    }
    // assists + penalty tallies come from the per-player match line
    for (const r of m.ratings ?? []) {
      if (!r.playerId) continue;
      const s = (ps[r.playerId] ??= blank());
      s.assists += r.assists ?? 0;
      s.penScored += r.penScored ?? 0;
      s.penMissed += r.penMissed ?? 0;
      s.penWon += r.penWon ?? 0;
      s.penCommitted += r.penCommitted ?? 0;
      s.penSaved += r.penSaved ?? 0;
    }
    for (const l of m.lineups ?? []) for (const p of [...l.startXI, ...l.subs]) {
      if (!p.playerId) continue;
      (seenApp[p.playerId] ??= new Set()).add(m.id);
    }
  }
  for (const [pid, s] of Object.entries(seenApp)) { ps[pid] ??= blank(); ps[pid].apps = s.size; }

  await Promise.all([
    setDoc("scores", scores),
    setDoc("standings", standings),
    setDoc("playerStats", { updatedAt: new Date().toISOString(), players: ps }),
    setDoc("progression", { updatedAt: new Date().toISOString(), steps, totals }),
  ]);

  // score_history: append when a participant's total changed since last snapshot
  const { data: lastRows } = await supa.from("score_history").select("participant_id,total,at").order("at", { ascending: false }).limit(participants.length * 2);
  const lastTotal = new Map<string, number>();
  for (const r of lastRows ?? []) if (!lastTotal.has(r.participant_id)) lastTotal.set(r.participant_id, r.total);
  const at = new Date().toISOString();
  const hist = scores.leaderboard.filter((e) => lastTotal.get(e.participantId) !== e.total)
    .map((e) => ({ participant_id: e.participantId, at, total: e.total }));
  if (hist.length) await supa.from("score_history").upsert(hist);
}

// ---------------------------------------------------------------------------
// Hand-fixed positions where the data feed mislabels a player (drives the goal multiplier).
const POSITION_OVERRIDE: Record<string, "GK" | "DEF" | "MID" | "FWD"> = {
  "brazil-vinicius-junior": "FWD",
  "spain-lamine-yamal": "FWD",
  "france-m-olise": "FWD",
  "brazil-raphinha": "FWD",
  "belgium-j-doku": "FWD",
};

async function buildRoster(force = false) {
  const standings = await apiGet<{ league: { standings: ApiStandingRow[][] } }>("standings", { league: WC_LEAGUE, season: WC_SEASON });
  const groups = standings[0]?.league.standings ?? [];
  await reconcileTeams(groups, []);
  // enrich teams with logo/code/venue
  const teamEntries = await apiGet<ApiTeamEntry>("teams", { league: WC_LEAGUE, season: WC_SEASON });
  for (const e of teamEntries) {
    await supa.from("teams").update({
      logo: e.team.logo ?? null, code: e.team.code ?? null,
      venue: e.venue ? { name: e.venue.name, city: e.venue.city, capacity: e.venue.capacity ?? null, image: e.venue.image ?? null } : null,
    }).eq("api_id", e.team.id);
  }
  // players per team. The player fetch is throttled (1.2s/call) and ~48 squads can exceed the
  // edge function's wall-clock limit in one invocation, so skip teams that already have players
  // (unless ?force) — re-running ?mode=roster then resumes and fills the remainder.
  const { data: teams } = await supa.from("teams").select("id,api_id");
  const havePlayers = await selectAll("players", "team_id");
  const haveSet = new Set(havePlayers.map((p) => p.team_id as string));
  const used = new Set<string>();
  let processed = 0; let skipped = 0;
  for (const t of teams ?? []) {
    if (!t.api_id) continue;
    if (!force && haveSet.has(t.id)) { skipped++; continue; }
    const entries = await apiGetAllPages<ApiPlayerEntry>("players", { team: t.api_id, season: WC_SEASON });
    // Normalize to {id,name,photo,position,number}. World Cup debutants (e.g. Cape Verde) have no
    // per-season `players` stats yet, so fall back to the `players/squads` endpoint for the roster.
    let normalized = entries.map((e) => ({
      id: e.player.id, name: e.player.name, photo: e.player.photo ?? null,
      position: e.statistics.find((s) => s.games?.position)?.games.position ?? e.player.position ?? null,
      number: null as number | null,
    }));
    if (!normalized.length) {
      const sq = await apiGet<{ players: { id: number; name: string; number: number | null; position: string | null; photo: string | null }[] }>("players/squads", { team: t.api_id });
      normalized = (sq[0]?.players ?? []).map((p) => ({ id: p.id, name: p.name, photo: p.photo ?? null, position: p.position, number: p.number ?? null }));
    }
    const rows = normalized.map((e) => {
      let id = `${t.id}-${slug(e.name)}`; let n = 2;
      while (used.has(id)) id = `${t.id}-${slug(e.name)}-${n++}`;
      used.add(id);
      const pos = POSITION_OVERRIDE[id] ?? mapPosition(e.position);
      return { id, api_id: e.id, name: e.name, team_id: t.id, position: pos,
        goal_multiplier: GOAL_MULTIPLIER[pos], photo: e.photo, number: e.number, updated_at: new Date().toISOString() };
    });
    if (rows.length) await supa.from("players").upsert(rows, { onConflict: "id" });
    processed++;
  }
  return { teams: teams?.length ?? 0, processed, skipped, remaining: (teams?.length ?? 0) - haveSet.size - processed };
}

async function refreshExtras(st: State) {
  const toLine = (s: ApiPlayerStat, v: number | null) => {
    const x = s.statistics[0];
    return { playerId: st.playerByApi.get(s.player.id) ?? null, apiId: s.player.id, name: s.player.name,
      teamId: x ? st.teamByApi.get(x.team.id)?.id ?? null : null, teamName: x?.team.name ?? "", photo: s.player.photo ?? null,
      position: x ? mapPosition(x.games.position) : null, value: v ?? 0, goals: x?.goals.total ?? 0, assists: x?.goals.assists ?? 0, appearances: x?.games.appearences ?? 0 };
  };
  const [sc, as, cd, inj] = await Promise.all([
    apiGet<ApiPlayerStat>("players/topscorers", { league: WC_LEAGUE, season: WC_SEASON }),
    apiGet<ApiPlayerStat>("players/topassists", { league: WC_LEAGUE, season: WC_SEASON }),
    apiGet<ApiPlayerStat>("players/topyellowcards", { league: WC_LEAGUE, season: WC_SEASON }),
    apiGet<ApiInjury>("injuries", { league: WC_LEAGUE, season: WC_SEASON }),
  ]);
  await setDoc("stats", { updatedAt: new Date().toISOString(),
    topScorers: sc.map((s) => toLine(s, s.statistics[0]?.goals.total ?? 0)),
    topAssists: as.map((s) => toLine(s, s.statistics[0]?.goals.assists ?? 0)),
    topCards: cd.map((s) => toLine(s, s.statistics[0]?.cards.yellow ?? 0)) });
  await setDoc("injuries", { updatedAt: new Date().toISOString(),
    items: inj.map((i) => ({ playerId: st.playerByApi.get(i.player.id) ?? null, apiId: i.player.id, name: i.player.name,
      teamId: st.teamByApi.get(i.team.id)?.id ?? null, teamName: i.team.name, type: i.type, reason: i.reason })) });
}

// --- player club backfill --------------------------------------------------
// API-Football has no club field on a national-team squad call, so look up each player's domestic
// club individually (1 request each). That's far too many for the whole roster, so only fill the
// players people actually open: their six-scorer picks and anyone who has scored. A few per run,
// throttled; club null = not looked up, {} = looked up but none found.
const CLUB_SEASONS = [2025, 2024];
// Confirmed current-club corrections the data source hasn't caught — e.g. a mid-season transfer that
// API-Football hasn't logged in the player's team history yet, so `pickClub` can't derive it. Applied
// on every full reconcile so they stick regardless of enrichment. Keyed by our player id.
const CLUB_OVERRIDE: Record<string, { name: string; logo: string | null; league: string }> = {
  "germany-p-gro": { name: "Brighton", logo: "https://media.api-sports.io/football/teams/51.png", league: "Premier League" }, // rejoined Brighton Jan 2026
};
async function applyClubOverrides() {
  for (const [id, club] of Object.entries(CLUB_OVERRIDE)) {
    try { await supa.from("players").update({ club }).eq("id", id); } catch (_) { /* non-fatal */ }
  }
}
interface ApiPlayerProfile {
  player: { id: number };
  statistics: {
    team: { id: number; name: string; logo: string | null };
    league: { id: number; name: string; country: string | null };
    games: { appearences: number | null };
  }[];
}
// The player's club = the team they made the most appearances for in a *domestic* competition.
// API-Football marks international comps (national team, Champions League, friendlies) with
// league.country === "World"; a real country means a club league. league.type is unreliable (null).
function pickClub(stats: ApiPlayerProfile["statistics"]) {
  const domestic = stats.filter((s) => s.league?.country && s.league.country !== "World" && s.team?.name);
  if (!domestic.length) return null;
  const byTeam = new Map<string, { name: string; logo: string | null; apps: number; league: string | null; leagueApps: number }>();
  for (const s of domestic) {
    const apps = s.games?.appearences ?? 0;
    const cur = byTeam.get(s.team.name) ?? { name: s.team.name, logo: s.team.logo ?? null, apps: 0, league: null, leagueApps: -1 };
    cur.apps += apps;
    if (apps > cur.leagueApps) { cur.leagueApps = apps; cur.league = s.league.name ?? null; } // their main domestic league
    byTeam.set(s.team.name, cur);
  }
  const best = [...byTeam.values()].sort((a, b) => b.apps - a.apps)[0];
  return { name: best.name, logo: best.logo, league: best.league };
}
async function backfillClubs(st: State, priority: Set<string>, limit = 10) {
  const candidates = st.players.filter((p) => priority.has(p.id as string) && p.api_id && p.club == null);
  let done = 0;
  for (const p of candidates) {
    if (done >= limit) break;
    try {
      let club: { name: string; logo: string | null; league: string | null } | Record<string, never> = {};
      for (const season of CLUB_SEASONS) {
        const res = await apiGet<ApiPlayerProfile>("players", { id: p.api_id as number, season });
        const c = pickClub(res[0]?.statistics ?? []);
        if (c) { club = { name: c.name, logo: c.logo, league: c.league }; break; }
      }
      await supa.from("players").update({ club }).eq("id", p.id as string);
      done++;
    } catch (_) { /* non-fatal */ }
  }
  return done;
}

// ---------------------------------------------------------------------------
// One-off enrichment for the daily player game (Footle): shirt number + age for everyone, and
// domestic club + league for players in recognizable leagues (these define the puzzle answer pool).

// National-team shirt number + age from the squads endpoint (1 call/team). Resumable in chunks.
async function enrichSquads(meta: { squadCursor?: number }): Promise<{ from: number; to: number; total: number; updated: number }> {
  const teams = (await selectAll("teams", "id,api_id")).filter((t) => t.api_id) as unknown as { id: string; api_id: number }[];
  const total = teams.length;
  const start = (meta.squadCursor ?? 0) % (total || 1);
  const end = Math.min(start + 12, total);
  let updated = 0;
  for (let i = start; i < end; i++) {
    const sq = await apiGet<{ players: { id: number; number: number | null; age: number | null }[] }>("players/squads", { team: teams[i].api_id });
    for (const p of sq[0]?.players ?? []) {
      const patch: Record<string, unknown> = {};
      if (p.number != null) patch.number = p.number;
      if (p.age != null) patch.age = p.age;
      if (Object.keys(patch).length > 0) { await supa.from("players").update(patch).eq("api_id", p.id); updated++; }
    }
  }
  meta.squadCursor = end >= total ? 0 : end;
  return { from: start, to: end, total, updated };
}

// Recognizable club leagues (API-Football league ids) → the daily game's answer pool.
const TOP_LEAGUE_IDS = [
  39, 140, 135, 78, 61, // Big Five: Premier League, La Liga, Serie A, Bundesliga, Ligue 1
  88, 94, 307, 253, 40, // Eredivisie, Primeira Liga, Saudi Pro League, MLS, Championship
];
interface ApiLeaguePlayer {
  player: { id: number };
  statistics: { team: { id: number; name: string; logo: string | null }; league: { name: string | null; country: string | null } }[];
}
// Club + league for one recognizable league's players, matched to our World Cup players. Resumable
// one league per invocation via meta.leagueCursor.
async function enrichLeagues(meta: { leagueCursor?: number }): Promise<{ league: number; matched: number; seen: number; index: number; done: boolean }> {
  const players = await selectAll("players", "id,api_id");
  const byApi = new Map<number, string>();
  for (const p of players) if (p.api_id) byApi.set(p.api_id as number, p.id as string);
  const li = (meta.leagueCursor ?? 0) % TOP_LEAGUE_IDS.length;
  const lid = TOP_LEAGUE_IDS[li];
  const entries = await apiGetAllPages<ApiLeaguePlayer>("players", { league: lid, season: 2025 });
  let matched = 0;
  for (const e of entries) {
    const ourId = byApi.get(e.player.id);
    if (!ourId) continue;
    const s0 = e.statistics?.[0];
    if (!s0?.team?.name) continue;
    const club = { name: s0.team.name, logo: s0.team.logo ?? null, league: s0.league?.name ?? null };
    await supa.from("players").update({ club }).eq("id", ourId);
    matched++;
  }
  const next = li + 1;
  meta.leagueCursor = next >= TOP_LEAGUE_IDS.length ? 0 : next;
  return { league: lid, matched, seen: entries.length, index: li, done: next >= TOP_LEAGUE_IDS.length };
}

// Flag WC players who appeared in a recent Champions League (league 2) — the daily game's answer
// "fame" gate. The extra 2022 season catches stars (Messi/Ronaldo) now in MLS/Saudi. One season/call.
const UCL_LEAGUE = 2;
const UCL_SEASONS = [2025, 2024, 2023, 2022];
// A UCL season's player list is ~80 pages — too big for one invocation's wall-clock, so page through
// it in chunks, resumable via meta.uclSeasonIdx + meta.uclPage.
async function enrichUcl(meta: { uclSeasonIdx?: number; uclPage?: number }): Promise<{ season: number; page: number; matched: number; pages: number; seasonDone: boolean; done: boolean }> {
  const players = await selectAll("players", "id,api_id");
  const byApi = new Map<number, string>();
  for (const p of players) if (p.api_id) byApi.set(p.api_id as number, p.id as string);
  const si = meta.uclSeasonIdx ?? 0;
  if (si >= UCL_SEASONS.length) { meta.uclSeasonIdx = 0; meta.uclPage = 1; return { season: 0, page: 1, matched: 0, pages: 0, seasonDone: true, done: true }; }
  const season = UCL_SEASONS[si];
  let page = meta.uclPage ?? 1;
  let matched = 0, pages = 0, seasonDone = false;
  for (; pages < 25; pages++, page++) {
    const res = await apiGet<{ player: { id: number } }>("players", { league: UCL_LEAGUE, season, page });
    const ids = res.map((e) => byApi.get(e.player.id)).filter((x): x is string => !!x);
    for (let j = 0; j < ids.length; j += 200) await supa.from("players").update({ ucl: true }).in("id", ids.slice(j, j + 200));
    matched += ids.length;
    if (res.length < 20) { seasonDone = true; break; } // last page of the season
  }
  if (seasonDone) { meta.uclSeasonIdx = si + 1; meta.uclPage = 1; } else meta.uclPage = page;
  const done = seasonDone && si + 1 >= UCL_SEASONS.length;
  return { season, page: meta.uclPage ?? 1, matched, pages, seasonDone, done };
}

// Per-player career club history (clubs + the seasons spent at each) from players/teams. Powers the
// daily game's "shared club" clue. ~1 call/player; resumable (club_history null = not fetched) and
// reserve-guarded so it never starves live coverage.
interface ApiPlayerTeams { team: { id: number; name: string; logo: string | null; national?: boolean }; seasons: number[] }
async function enrichClubHistory(limit: number): Promise<{ done: number; remaining: number; quota: number }> {
  const { data } = await supa.from("players").select("id,api_id")
    .is("club_history", null).not("age", "is", null).not("api_id", "is", null).limit(limit);
  const cands = (data ?? []) as { id: string; api_id: number }[];
  let done = 0;
  for (const p of cands) {
    try {
      const res = await apiGet<ApiPlayerTeams>("players/teams", { player: p.api_id });
      const hist = res.map((e) => ({ id: e.team.id, name: e.team.name, logo: e.team.logo ?? null, seasons: e.seasons ?? [], national: e.team.national === true }));
      await supa.from("players").update({ club_history: hist }).eq("id", p.id);
      done++;
    } catch (_) { /* non-fatal */ }
  }
  const { count } = await supa.from("players").select("id", { count: "exact", head: true })
    .is("club_history", null).not("age", "is", null).not("api_id", "is", null);
  return { done, remaining: count ?? -1, quota: requestsRemaining() };
}

// Richer UCL history back to ~2000: per player, the set of distinct campaigns played (ucl_seasons) and
// whether they ever reached the knockout stage (ucl_ko). Knockout teams per season are derived from
// that season's fixtures. Idempotent via the ucl_mark() SQL function, so resumable re-runs are safe.
const UCL_LONG: number[] = Array.from({ length: 2025 - 2000 + 1 }, (_, i) => 2025 - i); // 2025 → 2000
const UCL_KO_RE = /16|quarter|semi|final|knockout|play-?off/i;
async function enrichUcl2(meta: { uclSeason2?: number; uclPage2?: number }): Promise<{ season: number; page: number; matched: number; pages: number; seasonDone: boolean; done: boolean }> {
  const si = meta.uclSeason2 ?? 0;
  if (si >= UCL_LONG.length) { meta.uclSeason2 = 0; meta.uclPage2 = 1; return { season: 0, page: 1, matched: 0, pages: 0, seasonDone: true, done: true }; }
  const season = UCL_LONG[si];
  // Group/league-phase teams come from the standings (robust across the old group format and the new
  // 36-team league phase, unlike round-name parsing); knockout teams from the fixtures.
  const standings = await apiGet<{ league: { standings: ApiStandingRow[][] } }>("standings", { league: 2, season });
  const grp = new Set<number>();
  for (const table of standings[0]?.league.standings ?? []) for (const row of table) grp.add(row.team.id);
  const fixtures = await apiGet<ApiFixture>("fixtures", { league: 2, season });
  const ko = new Set<number>();
  for (const f of fixtures) if (UCL_KO_RE.test(f.league.round)) { ko.add(f.teams.home.id); ko.add(f.teams.away.id); }
  const players = await selectAll("players", "id,api_id");
  const byApi = new Map<number, string>();
  for (const p of players) if (p.api_id) byApi.set(p.api_id as number, p.id as string);
  let page = meta.uclPage2 ?? 1, matched = 0, pages = 0, seasonDone = false;
  for (; pages < 25; pages++, page++) {
    const res = await apiGet<{ player: { id: number }; statistics: { team: { id: number } }[] }>("players", { league: 2, season, page });
    const ids: string[] = [], koIds: string[] = [];
    for (const e of res) {
      const ourId = byApi.get(e.player.id);
      const tid = e.statistics?.[0]?.team?.id;
      if (!ourId || !tid || !grp.has(tid)) continue; // qualifier-only season ⇒ not a campaign
      ids.push(ourId);
      if (ko.has(tid)) koIds.push(ourId);
    }
    if (ids.length) await supa.rpc("ucl_mark", { ids, yr: season, ko_ids: koIds });
    matched += ids.length;
    if (res.length < 20) { seasonDone = true; break; }
  }
  if (seasonDone) { meta.uclSeason2 = si + 1; meta.uclPage2 = 1; } else meta.uclPage2 = page;
  const done = seasonDone && si + 1 >= UCL_LONG.length;
  return { season, page: meta.uclPage2 ?? 1, matched, pages, seasonDone, done };
}


// outside the answer pool) so every valid guess compares meaningfully. Per-player; naturally
// resumable (each call takes the next club==null squad members).
async function enrichClubsBulk(limit: number): Promise<{ done: number; remaining: number }> {
  const players = await selectAll("players", "id,api_id,club,age");
  const pending = players.filter((p) => p.api_id && p.club == null && p.age != null);
  let done = 0;
  for (const p of pending) {
    if (done >= limit) break;
    try {
      let club: { name: string; logo: string | null; league: string | null } | Record<string, never> = {};
      for (const season of CLUB_SEASONS) {
        const res = await apiGet<ApiPlayerProfile>("players", { id: p.api_id as number, season });
        const c = pickClub(res[0]?.statistics ?? []);
        if (c) { club = { name: c.name, logo: c.logo, league: c.league }; break; }
      }
      await supa.from("players").update({ club }).eq("id", p.id as string);
      done++;
    } catch (_) { /* non-fatal */ }
  }
  return { done, remaining: pending.length - done };
}

// ---------------------------------------------------------------------------
// Career-best World Cup finish per player (1=Winner … 7=Group Stage, 8=Debut/none). Top 4 per past
// edition are fixed historical facts; QF/R16/Group are derived from round participation in that
// edition's fixtures (avoids needing penalty results). Resumable by season + page.
const WC_PAST_SEASONS = [2022, 2018, 2014, 2010, 2006];
const WC_TOP4: Record<number, Record<string, number>> = {
  2022: { Argentina: 1, France: 2, Croatia: 3, Morocco: 4 },
  2018: { France: 1, Croatia: 2, Belgium: 3, England: 4 },
  2014: { Germany: 1, Argentina: 2, Netherlands: 3, Brazil: 4 },
  2010: { Spain: 1, Netherlands: 2, Germany: 3, Uruguay: 4 },
  2006: { Italy: 1, France: 2, Germany: 3, Portugal: 4 },
};
async function enrichWcHistory(meta: { wcSeasonIdx?: number; wcPage?: number }): Promise<{ season: number; page: number; matched: number; pages: number; seasonDone: boolean; done: boolean }> {
  const si = meta.wcSeasonIdx ?? 0;
  if (si >= WC_PAST_SEASONS.length) { meta.wcSeasonIdx = 0; meta.wcPage = 1; return { season: 0, page: 1, matched: 0, pages: 0, seasonDone: true, done: true }; }
  const season = WC_PAST_SEASONS[si];
  const fixtures = await apiGet<ApiFixture>("fixtures", { league: 1, season });
  const qf = new Set<number>(), r16 = new Set<number>();
  for (const f of fixtures) {
    const r = f.league.round;
    if (/quarter/i.test(r)) { qf.add(f.teams.home.id); qf.add(f.teams.away.id); }
    else if (/round of 16/i.test(r)) { r16.add(f.teams.home.id); r16.add(f.teams.away.id); }
  }
  const top4 = WC_TOP4[season] ?? {};
  const players = await selectAll("players", "id,api_id");
  const byApi = new Map<number, string>();
  for (const p of players) if (p.api_id) byApi.set(p.api_id as number, p.id as string);
  let page = meta.wcPage ?? 1, matched = 0, pages = 0, seasonDone = false;
  for (; pages < 25; pages++, page++) {
    const res = await apiGet<{ player: { id: number }; statistics: { team: { id: number; name: string } }[] }>("players", { league: 1, season, page });
    for (const e of res) {
      const ourId = byApi.get(e.player.id);
      const team = e.statistics?.[0]?.team;
      if (!ourId || !team) continue;
      const finish = top4[team.name] ?? (qf.has(team.id) ? 5 : r16.has(team.id) ? 6 : 7);
      await supa.from("players").update({ wc_best: finish }).eq("id", ourId).gt("wc_best", finish); // keep best (lowest)
      matched++;
    }
    if (res.length < 20) { seasonDone = true; break; }
  }
  if (seasonDone) { meta.wcSeasonIdx = si + 1; meta.wcPage = 1; } else meta.wcPage = page;
  const done = seasonDone && si + 1 >= WC_PAST_SEASONS.length;
  return { season, page: meta.wcPage ?? 1, matched, pages, seasonDone, done };
}

// ---------------------------------------------------------------------------
// Keep this many daily API requests in reserve for the cron's live updates (fixtures, lineups,
// scores). Heavy one-off backfills stand down below it so they can never starve match coverage.
const API_RESERVE = 3500;
const HEAVY_MODES = new Set(["squads", "leagues", "ucl", "ucl2", "wchistory", "clubs", "clubhistory"]);
Deno.serve(async (req) => {
  try {
    const mode = new URL(req.url).searchParams.get("mode");
    if (mode && HEAVY_MODES.has(mode) && requestsRemaining() < API_RESERVE) {
      return Response.json({ ok: true, mode, skipped: "low API quota — reserved for live updates", remaining: requestsRemaining() });
    }
    if (mode === "clubs") {
      const n = Number(new URL(req.url).searchParams.get("n") ?? "25");
      const r = await enrichClubsBulk(n);
      return Response.json({ ok: true, mode, ...r, requests: requestCount() });
    }
    if (mode === "clubhistory") {
      const n = Number(new URL(req.url).searchParams.get("n") ?? "40");
      const r = await enrichClubHistory(n);
      return Response.json({ ok: true, mode, ...r, requests: requestCount() });
    }
    if (mode === "roster") {
      const force = new URL(req.url).searchParams.get("force") === "1";
      const r = await buildRoster(force);
      return Response.json({ ok: true, mode, ...r, requests: requestCount() });
    }
    if (mode === "squads") {
      const meta = await getMeta();
      const r = await enrichSquads(meta);
      await setDoc("_meta", meta);
      return Response.json({ ok: true, mode, ...r, requests: requestCount() });
    }
    if (mode === "leagues") {
      const meta = await getMeta();
      const r = await enrichLeagues(meta);
      await setDoc("_meta", meta);
      return Response.json({ ok: true, mode, ...r, requests: requestCount() });
    }
    if (mode === "ucl") {
      const meta = await getMeta();
      const r = await enrichUcl(meta);
      await setDoc("_meta", meta);
      return Response.json({ ok: true, mode, ...r, requests: requestCount() });
    }
    if (mode === "wchistory") {
      const meta = await getMeta();
      const r = await enrichWcHistory(meta);
      await setDoc("_meta", meta);
      return Response.json({ ok: true, mode, ...r, requests: requestCount() });
    }
    if (mode === "ucl2") {
      const meta = await getMeta();
      const r = await enrichUcl2(meta);
      await setDoc("_meta", meta);
      return Response.json({ ok: true, mode, ...r, requests: requestCount() });
    }
    // Re-fetch club history in batches to backfill the `national` flag (added later). Paginated by a
    // cursor; call repeatedly until next===0. Overwrites in place so the daily clue never blanks.
    if (mode === "rehist") {
      const meta = await getMeta();
      const start = meta.histCursor ?? 0;
      const BATCH = 50;
      const { data } = await supa.from("players").select("id,api_id").not("api_id", "is", null).order("id").range(start, start + BATCH - 1);
      const rows = (data ?? []) as { id: string; api_id: number }[];
      let done = 0;
      for (const p of rows) {
        try {
          const res = await apiGet<ApiPlayerTeams>("players/teams", { player: p.api_id });
          const hist = res.map((e) => ({ id: e.team.id, name: e.team.name, logo: e.team.logo ?? null, seasons: e.seasons ?? [], national: e.team.national === true }));
          await supa.from("players").update({ club_history: hist }).eq("id", p.id);
          done++;
        } catch (_) { /* non-fatal */ }
      }
      meta.histCursor = rows.length === BATCH ? start + BATCH : 0;
      await setDoc("_meta", meta);
      return Response.json({ ok: true, mode, start, done, next: meta.histCursor, requests: requestCount() });
    }

    const meta = await getMeta();
    const now = Date.now();

    let st = await loadState();
    const updated = new Map<string, Match>(); // our match id -> Match (for the upsert + scoring)
    for (const r of st.matchRows) updated.set(r.id as string, rowToMatch(r));

    // Is a match live or about to start? Drives how hard we poll — when nothing is on we reconcile
    // sparingly and skip the live/lineup fetches entirely (saves thousands of idle requests/day).
    const matchActive = [...updated.values()].some((m) => {
      if (m.status === "LIVE" || m.status === "HT") return true;
      if (m.status !== "SCHEDULED") return false;
      const toKo = Date.parse(m.kickoff) - now;
      return toKo < 75 * 60 * 1000 && toKo > -STALE_LIVE_MS; // imminent, or just kicked off (status not updated yet)
    });
    const forceFull = mode === "full" || !meta.lastFull
      || now - Date.parse(meta.lastFull) > (matchActive ? FULL_INTERVAL_MS : IDLE_FULL_INTERVAL_MS);

    // ----- full reconcile: every fixture's status/score, teams, bracket -----
    if (forceFull) {
      const fixtures = await apiGet<ApiFixture>("fixtures", { league: WC_LEAGUE, season: WC_SEASON });
      const standings = await apiGet<{ league: { standings: ApiStandingRow[][] } }>("standings", { league: WC_LEAGUE, season: WC_SEASON });
      await reconcileTeams(standings[0]?.league.standings ?? [], fixtures);
      await applyClubOverrides(); // pin manually-corrected current clubs the feed hasn't caught
      st = await loadState(); // refresh team→group after upsert
      const gids = groupIds(fixtures, st);
      const kids = knockoutIds(fixtures, st); // confirmed (drawn) knockout ties only
      const idFor = (fid: number): { id: string; phase?: Match["phase"] } | null => {
        const g = gids.get(fid); if (g) return { id: g.id };
        const k = kids.get(fid); if (k) return { id: k.id, phase: k.phase };
        return null;
      };
      // fetch details for played matches that changed or lack events
      const need: number[] = [];
      for (const f of fixtures) {
        const idg = idFor(f.fixture.id);
        if (!idg) continue;
        const status = mapStatus(f.fixture.status.short);
        const cur = updated.get(idg.id);
        const played = status === "LIVE" || status === "HT" || status === "FINISHED";
        const goalChanged = !cur || (cur.homeGoals ?? 0) + (cur.awayGoals ?? 0) !== (f.goals.home ?? 0) + (f.goals.away ?? 0) || !cur.events;
        // pull lineups pre-match: imminent kickoff (next ~75 min) and we don't have them yet
        const toKo = Date.parse(f.fixture.date) - Date.now();
        const imminentNoLineup = status === "SCHEDULED" && toKo < 75 * 60 * 1000 && toKo > -3 * 60 * 60 * 1000 && !(cur?.lineups && cur.lineups.length > 0);
        if ((played && goalChanged) || imminentNoLineup) need.push(f.fixture.id);
      }
      const details = await fetchDetails(need.slice(0, 60), st);
      for (const f of fixtures) {
        const idg = idFor(f.fixture.id);
        if (!idg) continue;
        const prev = updated.get(idg.id);
        const built = buildMatch(f, idg.id, st, details.get(f.fixture.id), prev, idg.phase);
        // never revert a finished match to live (guards against a feed that keeps re-reporting "in play")
        if (prev?.status === "FINISHED" && (built.status === "LIVE" || built.status === "HT")) {
          built.status = "FINISHED"; built.elapsed = null;
        }
        updated.set(idg.id, built);
      }
      await setDoc("bracket", buildBracket(fixtures, st));

      // head-to-head (historical → fetch a few per run for matches that still lack it). Any fixture
      // with both teams confirmed qualifies — including knockout ties (group "?"), so e.g. an R32
      // tie shows its all-time meetings, not just group games.
      const needH2H = [...updated.values()].filter((m) => m.homeTeamId && m.awayTeamId && !m.h2h).slice(0, 6);
      for (const m of needH2H) {
        const fx = fixtures.find((f) => idFor(f.fixture.id)?.id === m.id);
        if (!fx) continue;
        try {
          const h2h = await apiGet<ApiFixture>("fixtures/headtohead", { h2h: `${fx.teams.home.id}-${fx.teams.away.id}`, last: 6 });
          m.h2h = h2h.map((f) => ({ date: f.fixture.date, homeName: f.teams.home.name, awayName: f.teams.away.name,
            homeGoals: f.goals.home, awayGoals: f.goals.away, league: f.league.name ?? f.league.round }));
          updated.set(m.id, m);
        } catch (_) { /* non-fatal */ }
      }
      meta.lastFull = new Date().toISOString();
    }

    // ----- live poll: fast path for in-progress matches (only when something is on) ----------
    let liveCount = 0;
    if (matchActive) {
    const live = (await apiGet<ApiFixture>("fixtures", { live: "all" })).filter((f) => f.league.id === WC_LEAGUE);
    liveCount = live.length;
    const liveIds = new Set<number>(live.map((f) => f.fixture.id));
    // also force-reconcile any of OUR matches stuck LIVE past a sane window
    for (const m of updated.values()) {
      if (m.apiId && m.status !== "FINISHED" && m.status !== "SCHEDULED" && Date.now() - Date.parse(m.kickoff) > STALE_LIVE_MS) liveIds.add(m.apiId);
    }
    if (liveIds.size) {
      const details = await fetchDetails([...liveIds], st);
      const liveById = new Map(live.map((f) => [f.fixture.id, f]));
      for (const m of updated.values()) {
        if (!m.apiId) continue;
        const f = liveById.get(m.apiId);
        const d = details.get(m.apiId);
        // carry the match's known phase through the live rebuild — otherwise a knockout tie loses its
        // phase (and gets a stray group_letter) the moment it goes live, reverting its round factor to ×1.
        if (f) updated.set(m.id, buildMatch(f, m.id, st, d, m, m.phase));
      }
    }

    // pre-match lineups: the official XI lands on the dedicated /fixtures/lineups endpoint ~20-60 min
    // before kickoff, well before it appears in the embedded fixtures payload. Pull it every tick for
    // imminent scheduled games so the formation shows up promptly (a few calls at most).
    const preLineup = [...updated.values()].filter((m) => {
      if (!m.apiId || m.status !== "SCHEDULED" || (m.lineups && m.lineups.length > 0)) return false;
      const toKo = Date.parse(m.kickoff) - Date.now();
      return toKo < 75 * 60 * 1000 && toKo > -3 * 60 * 60 * 1000;
    }).slice(0, 10);
    for (const m of preLineup) {
      try {
        const ls = await apiGet<ApiLineup>("fixtures/lineups", { fixture: m.apiId! });
        const mapped = mapLineups(ls, st);
        if (mapped.length > 0 && mapped.some((l) => l.startXI.length > 0)) { m.lineups = mapped; updated.set(m.id, m); }
      } catch (_) { /* non-fatal — lineups simply not out yet */ }
    }
    } // end if (matchActive)

    // capture/refresh venue weather (live now; finished games backfilled at kickoff time, then frozen)
    await refreshWeather(updated);

    // upsert all changed matches
    // safety: a match stuck "live" far past kickoff (feed never posted Full Time) → finalize at the
    // current score so standings/scoring can complete and live-polling stops.
    for (const m of updated.values()) {
      if ((m.status === "LIVE" || m.status === "HT") && Date.now() - Date.parse(m.kickoff) > FINALIZE_STALE_MS) {
        updated.set(m.id, { ...m, status: "FINISHED", elapsed: null });
      }
    }

    // Only write rows that actually changed (new row, or a meaningful field differs). Skipping
    // no-op upserts avoids a realtime fan-out of every match to every client on every tick.
    const origById = new Map(st.matchRows.map((r) => [r.id as string, r]));
    const rows = [...updated.values()].map((m) => matchToRow(m)).filter((row) => {
      const orig = origById.get(row.id);
      return !orig || matchSig(orig) !== matchSig(row);
    });
    if (rows.length) { const { error } = await supa.from("matches").upsert(rows, { onConflict: "id" }); if (error) console.error("matches upsert failed:", error.message); }

    // occasional extras (only around match time — saves idle requests)
    if (matchActive && (!meta.lastStats || now - Date.parse(meta.lastStats) > STATS_INTERVAL_MS)) {
      st = await loadState();
      try { await refreshExtras(st); meta.lastStats = new Date().toISOString(); } catch (_) { /* non-fatal */ }
    }

    // recompute scores from the freshest rows
    st = await loadState();
    await recomputeAndStore(st, st.matchRows);

    // backfill clubs for the players people open (picks + scorers), a few per full reconcile
    if (forceFull) {
      const priority = new Set<string>();
      for (const part of st.participants) for (const pid of ((part.top_players as string[]) ?? [])) priority.add(pid);
      for (const r of st.matchRows) for (const g of ((r.goals as { playerId: string | null }[]) ?? [])) if (g.playerId) priority.add(g.playerId);
      try { await backfillClubs(st, priority); } catch (_) { /* non-fatal */ }
      // top up career club history (for the daily game) only when idle and quota is healthy, so it
      // completes on its own over quiet periods without ever eating into live-match coverage
      if (!matchActive && requestsRemaining() > 5500) {
        try { await enrichClubHistory(20); } catch (_) { /* non-fatal */ }
      }
    }
    await setDoc("_meta", meta);

    return Response.json({ ok: true, full: forceFull, active: matchActive, live: liveCount, requests: requestCount() });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500 });
  }
});
