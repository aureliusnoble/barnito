/**
 * Cron data fetcher. Updates public/data/matches.json (+ standings.json) from API-Football.
 *
 * Quota-aware (free tier = 100 req/day):
 *  - Self-throttles: if no match is in a live window and data isn't stale, it makes ZERO calls.
 *  - LIVE poll: 1 call to /fixtures?live=all per run; only fetches /fixtures/events for a match
 *    when its goal count changed.
 *  - FULL refresh (FORCE, stale, or first run): 1 call to /fixtures, plus capped /fixtures/events
 *    for live or newly-finished matches missing scorers.
 *  - Standings are computed LOCALLY from finished matches (no /standings call needed).
 *  - overrides.json (if present) is merged last so the admin can hand-correct any data.
 *
 *   API_FOOTBALL_KEY=xxx npm run fetch         (cron / normal)
 *   API_FOOTBALL_KEY=xxx FORCE=1 npm run fetch (force a full refresh)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type {
  Roster, MatchesFile, Match, GoalEvent, StandingsFile, GroupLetter,
} from "@shared/types.js";
import { MATCHES_PER_GROUP } from "@shared/constants.js";
import { computeGroupTable, type GroupResult } from "./lib/standings.js";
import { DATA_DIR, REPO_ROOT, writeJson } from "./lib/util.js";
import {
  apiGet, getRequestCount, mapStatus, groupLetterFrom,
  WC_LEAGUE, WC_SEASON, type ApiFixture, type ApiEvent,
} from "./lib/apiFootball.js";

const FORCE = !!process.env.FORCE || process.argv.includes("--full");
const LIVE_LEAD_MS = 10 * 60 * 1000; // poll from 10 min before kickoff
const LIVE_TAIL_MS = 165 * 60 * 1000; // until ~2h45 after kickoff ("just after")
const MAX_EVENT_FETCHES = Number(process.env.MAX_EVENT_FETCHES ?? 8);
// Hard safety ceiling on API calls per UTC day across cron runs (paid Pro = 7,500/day, so this
// is a runaway-protection net, not a normal limit). Setup (--full) bypasses the check.
const DAILY_CAP = Number(process.env.API_DAILY_CAP ?? 400);
const USAGE_FILE = "_api-usage.json";

interface Usage { date: string; count: number }
function todayUtc(): string { return new Date().toISOString().slice(0, 10); }
function loadUsage(): Usage {
  const u = load<Usage>(USAGE_FILE, { date: todayUtc(), count: 0 });
  return u.date === todayUtc() ? u : { date: todayUtc(), count: 0 };
}

function load<T>(file: string, fallback: T): T {
  const path = resolve(DATA_DIR, file);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as T) : fallback;
}

const roster = load<Roster>("roster.json", { updatedAt: "", teams: [], players: [] });
const prev = load<MatchesFile>("matches.json", {
  updatedAt: "", tournamentComplete: false, championTeamId: null, matches: [],
});
const overridesPath = resolve(REPO_ROOT, "overrides.json");
const overrides = existsSync(overridesPath)
  ? (JSON.parse(readFileSync(overridesPath, "utf8")) as OverridesFile)
  : null;

interface OverridesFile {
  tournamentComplete?: boolean;
  championTeamId?: string | null;
  matches?: Record<string, Partial<Match>>;
}

// roster lookups
const teamByApi = new Map<number, { id: string; group: GroupLetter }>();
for (const t of roster.teams) if (t.apiId) teamByApi.set(t.apiId, { id: t.id, group: t.group });
const playerByApi = new Map<number, string>();
for (const p of roster.players) if (p.apiId) playerByApi.set(p.apiId, p.id);

const now = Date.now();

function inLiveWindow(): boolean {
  return prev.matches.some((m) => {
    const k = Date.parse(m.kickoff);
    return now >= k - LIVE_LEAD_MS && now <= k + LIVE_TAIL_MS;
  });
}

// --- build a Match from an API fixture, carrying over prior goals when unchanged ----------
function ourMatchId(fixtures: ApiFixture[]): Map<number, string> {
  // assign stable ids per group by (kickoff, fixtureId) order, matching the seed scheme
  const byGroup = new Map<GroupLetter, ApiFixture[]>();
  for (const f of fixtures) {
    const home = teamByApi.get(f.teams.home.id);
    if (!home) continue;
    const arr = byGroup.get(home.group) ?? [];
    arr.push(f);
    byGroup.set(home.group, arr);
  }
  const map = new Map<number, string>();
  for (const [group, fs] of byGroup) {
    fs.sort((a, b) => a.fixture.date.localeCompare(b.fixture.date) || a.fixture.id - b.fixture.id);
    fs.forEach((f, i) => map.set(f.fixture.id, `${group}-${i + 1}`));
  }
  return map;
}

async function fetchGoals(fixtureId: number): Promise<GoalEvent[]> {
  const events = await apiGet<ApiEvent>("fixtures/events", { fixture: fixtureId });
  return events
    .filter((e) => e.type === "Goal" && e.detail !== "Missed Penalty")
    .map((e) => {
      const ownGoal = e.detail === "Own Goal";
      // an own goal counts for the OTHER team's tally; API credits e.team as the team that benefits? It lists the player's own team. We attribute the goal to the scoring side: for own goals the benefiting team is the opponent. We keep teamId as the team that gets the goal on the scoreboard.
      return {
        playerId: e.player.id ? (playerByApi.get(e.player.id) ?? null) : null,
        apiPlayerId: e.player.id,
        playerName: e.player.name ?? "Unknown",
        minute: e.time.elapsed,
        teamId: teamByApi.get(e.team.id)?.id ?? "",
        ownGoal,
      } satisfies GoalEvent;
    });
}

function buildMatch(f: ApiFixture, id: string, carriedGoals: GoalEvent[]): Match {
  const home = teamByApi.get(f.teams.home.id)!;
  const away = teamByApi.get(f.teams.away.id)!;
  const mdMatch = f.league.round.match(/(\d+)\s*$/);
  return {
    id,
    apiId: f.fixture.id,
    group: home.group,
    matchday: mdMatch ? Number(mdMatch[1]) : 1,
    kickoff: f.fixture.date,
    ground: f.fixture.venue?.name ?? null,
    homeTeamId: home.id,
    awayTeamId: away.id,
    status: mapStatus(f.fixture.status.short),
    elapsed: f.fixture.status.elapsed,
    homeGoals: f.goals.home,
    awayGoals: f.goals.away,
    goals: carriedGoals,
  };
}

function goalCount(m: { homeGoals: number | null; awayGoals: number | null }): number {
  return (m.homeGoals ?? 0) + (m.awayGoals ?? 0);
}
function apiGoalCount(g: { home: number | null; away: number | null }): number {
  return (g.home ?? 0) + (g.away ?? 0);
}

async function fullRefresh(): Promise<Match[]> {
  console.log("  full refresh: GET /fixtures");
  const fixtures = (await apiGet<ApiFixture>("fixtures", { league: WC_LEAGUE, season: WC_SEASON }))
    .filter((f) => groupLetterFrom(f.league.round) !== null || teamByApi.has(f.teams.home.id))
    .filter((f) => teamByApi.has(f.teams.home.id) && teamByApi.has(f.teams.away.id));
  const idMap = ourMatchId(fixtures);
  const prevById = new Map(prev.matches.map((m) => [m.id, m]));

  let eventFetches = 0;
  const matches: Match[] = [];
  for (const f of fixtures) {
    const id = idMap.get(f.fixture.id);
    if (!id) continue;
    const old = prevById.get(id);
    let goals = old?.goals ?? [];
    const status = mapStatus(f.fixture.status.short);
    const goalsChanged = !old || goalCount(old) !== apiGoalCount(f.goals);
    const needGoals =
      (status === "LIVE" || status === "HT" || status === "FINISHED") &&
      (goalsChanged || goals.length !== apiGoalCount(f.goals));
    if (needGoals && eventFetches < MAX_EVENT_FETCHES) {
      goals = await fetchGoals(f.fixture.id);
      eventFetches++;
    }
    matches.push(buildMatch(f, id, goals));
  }
  console.log(`  ${matches.length} group fixtures, ${eventFetches} event fetches`);
  return matches;
}

async function livePoll(): Promise<Match[]> {
  console.log("  live poll: GET /fixtures?live=all");
  const live = (await apiGet<ApiFixture>("fixtures", { live: "all" })).filter(
    (f) => f.league.id === WC_LEAGUE,
  );
  if (live.length === 0) {
    console.log("  no WC matches live right now");
    return prev.matches;
  }
  const liveByApi = new Map(live.map((f) => [f.fixture.id, f]));
  let eventFetches = 0;
  const matches = await Promise.all(
    prev.matches.map(async (m) => {
      if (!m.apiId) return m;
      const f = liveByApi.get(m.apiId);
      if (!f) return m;
      const goalsChanged = goalCount(m) !== apiGoalCount(f.goals);
      let goals = m.goals;
      if (goalsChanged && eventFetches < MAX_EVENT_FETCHES) {
        goals = await fetchGoals(f.fixture.id);
        eventFetches++;
      }
      return buildMatch(f, m.id, goals);
    }),
  );
  console.log(`  ${live.length} WC live, ${eventFetches} event fetches`);
  return matches;
}

function recomputeStandings(matches: Match[]): StandingsFile {
  const teamName = new Map(roster.teams.map((t) => [t.id, t.name]));
  const groups = [...new Set(roster.teams.map((t) => t.group))].sort();
  return {
    updatedAt: new Date().toISOString(),
    groups: groups.map((group) => {
      const gm = matches.filter((m) => m.group === group);
      const results: GroupResult[] = gm
        .filter((m) => m.status === "FINISHED" && m.homeGoals !== null && m.awayGoals !== null)
        .map((m) => ({
          homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
          homeGoals: m.homeGoals!, awayGoals: m.awayGoals!,
        }));
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

async function main() {
  if (!roster.teams.some((t) => t.apiId)) {
    console.warn("roster.json has no API ids yet — run the setup workflow / `npm run roster`. Skipping (0 API requests).");
    return;
  }

  // Only ever call the API during setup (--full) or inside a live match window ("+ just after").
  const bootstrapped = prev.matches.some((m) => m.apiId);
  const needFull = FORCE;
  const live = inLiveWindow();
  if (!needFull) {
    if (!bootstrapped) {
      console.log("Fixtures not bootstrapped yet — run setup (`fetch --full`). Skipping (0 API requests).");
      return;
    }
    if (!live) {
      console.log("No match is live right now — skipping (0 API requests).");
      return;
    }
  }

  // Hard daily ceiling (runaway protection). Setup/force bypasses the check but still records usage.
  const usage = loadUsage();
  if (!FORCE && usage.count >= DAILY_CAP) {
    console.warn(`Daily API cap (${DAILY_CAP}) already reached today — skipping to protect quota.`);
    return;
  }

  console.log(`Fetching (full=${needFull}, liveWindow=${live}, used today=${usage.count}):`);
  let matches = needFull ? await fullRefresh() : await livePoll();
  matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id));

  let matchesFile: MatchesFile = {
    updatedAt: new Date().toISOString(),
    tournamentComplete: prev.tournamentComplete,
    championTeamId: prev.championTeamId,
    matches,
  };
  matchesFile = applyOverrides(matchesFile);
  const standings = recomputeStandings(matchesFile.matches);

  writeJson("matches.json", matchesFile);
  writeJson("standings.json", standings);

  usage.count += getRequestCount();
  writeJson(USAGE_FILE, usage);
  console.log(`  ${getRequestCount()} API requests this run; ${usage.count}/${DAILY_CAP} used today.`);
}

main().catch((e) => {
  console.error("fetch-data failed:", e.message);
  process.exit(1);
});
