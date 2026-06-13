/**
 * Generate a realistic DEV/DEMO dataset from the committed openfootball 2026 schedule.
 * openfootball only fills in a handful of real results, so we synthesise a plausible
 * mid-tournament state (finished + live + upcoming, synthetic squads, goals, events,
 * lineups, live stats, ratings, top-scorers, injuries, forecasts) so every feature can be
 * exercised offline. Real data is produced by build-roster/fetch-data at runtime.
 *
 * Run: npm run seed   (optionally BARNITO_DEMO_NOW=2026-06-26T18:00:00Z)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  Roster, Team, Player, MatchesFile, Match, GoalEvent, MatchEvent, Lineup, LineupPlayer,
  TeamStat, PlayerRating, StandingsFile, StatsFile, InjuriesFile, ForecastsFile,
  PlayerStatLine, InjuryItem, Forecast, GroupLetter, Position, GoalMultiplier, Venue,
} from "@shared/types.js";
import { GOAL_MULTIPLIER, MATCHES_PER_GROUP } from "@shared/constants.js";
import { computeGroupTable, type GroupResult } from "./lib/standings.js";
import { REPO_ROOT, slug, toIsoUtc, writeJson, hash, rand, randInt } from "./lib/util.js";

const DEMO_NOW = new Date(process.env.BARNITO_DEMO_NOW ?? "2026-06-26T18:00:00Z").getTime();
const LIVE_WINDOW_MS = 2.5 * 60 * 60 * 1000;

interface OFMatch {
  date: string; time?: string; team1: string; team2: string; group?: string;
  ground?: string; score?: { ft?: [number, number] }; goals1?: { name: string; minute: string }[];
  goals2?: { name: string; minute: string }[];
}

const raw = JSON.parse(
  readFileSync(resolve(REPO_ROOT, "scripts/data/openfootball-2026.json"), "utf8"),
) as { matches: OFMatch[] };

const groupMatches = raw.matches.filter((m) => /^Group [A-L]$/.test(m.group ?? ""));
const groupOf = (m: OFMatch) => m.group!.replace("Group ", "") as GroupLetter;

const VENUES: Venue[] = [
  { name: "MetLife Stadium", city: "New York", capacity: 82500 },
  { name: "SoFi Stadium", city: "Los Angeles", capacity: 70000 },
  { name: "AT&T Stadium", city: "Dallas", capacity: 80000 },
  { name: "Mercedes-Benz Stadium", city: "Atlanta", capacity: 71000 },
  { name: "NRG Stadium", city: "Houston", capacity: 72000 },
  { name: "Lincoln Financial Field", city: "Philadelphia", capacity: 69000 },
  { name: "Levi's Stadium", city: "San Francisco", capacity: 68500 },
  { name: "Lumen Field", city: "Seattle", capacity: 69000 },
  { name: "Gillette Stadium", city: "Boston", capacity: 65000 },
  { name: "Arrowhead Stadium", city: "Kansas City", capacity: 76000 },
  { name: "Hard Rock Stadium", city: "Miami", capacity: 65000 },
  { name: "Estadio Azteca", city: "Mexico City", capacity: 87000 },
  { name: "Estadio Akron", city: "Guadalajara", capacity: 49000 },
  { name: "Estadio BBVA", city: "Monterrey", capacity: 53000 },
  { name: "BMO Field", city: "Toronto", capacity: 45000 },
  { name: "BC Place", city: "Vancouver", capacity: 54000 },
];

// --- teams -----------------------------------------------------------------
const teamNames = new Map<string, GroupLetter>();
for (const m of groupMatches) {
  teamNames.set(m.team1, groupOf(m));
  teamNames.set(m.team2, groupOf(m));
}
const teams: Team[] = [...teamNames.entries()]
  .map(([name, group]) => ({
    id: slug(name),
    name,
    code: name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase(),
    group,
    apiId: null,
    logo: null,
  }))
  .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
const teamIdByName = new Map(teams.map((t) => [t.name, t.id]));
const teamName = new Map(teams.map((t) => [t.id, t.name]));

// --- synthetic squads (14 per team: lineup + subs) -------------------------
const SURNAMES = [
  "Silva", "Santos", "García", "Müller", "Rossi", "Dubois", "Kovač", "Nakamura", "Okafor",
  "Andersson", "Novák", "Hassan", "Petrov", "Costa", "Fernández", "Schmidt", "Bianchi",
  "Martin", "Horvat", "Tanaka", "Diallo", "Larsson", "Dvořák", "Mansour", "Ivanov",
  "Pereira", "López", "Wagner", "Romano", "Bernard", "Marković", "Saitō", "Mensah",
  "Nilsson", "Černý", "Khalil", "Sokolov", "Almeida", "Torres", "Becker", "Greco",
  "Haaland", "Mbappé", "Yamal", "Bellingham", "Vinícius", "Musiala", "Osimhen", "Álvarez",
];
const INITIALS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T"];
const SQUAD: Position[] = ["GK", "GK", "DEF", "DEF", "DEF", "DEF", "DEF", "MID", "MID", "MID", "MID", "FWD", "FWD", "FWD"];

const players: Player[] = [];
for (const team of teams) {
  SQUAD.forEach((position, i) => {
    const seed = `${team.id}-${i}`;
    const surname = SURNAMES[hash(seed) % SURNAMES.length];
    const initial = INITIALS[hash(seed + "x") % INITIALS.length];
    players.push({
      id: `${team.id}-${i}-${slug(surname)}`,
      apiId: null,
      name: `${initial}. ${surname}`,
      teamId: team.id,
      position,
      goalMultiplier: GOAL_MULTIPLIER[position] as GoalMultiplier,
      photo: null,
      number: i + 1,
    });
  });
}
const playersByTeam = new Map<string, Player[]>();
for (const p of players) {
  const arr = playersByTeam.get(p.teamId) ?? [];
  arr.push(p);
  playersByTeam.set(p.teamId, arr);
}
const roster: Roster = { updatedAt: new Date().toISOString(), teams, players };

// --- helpers ---------------------------------------------------------------
function synthScore(matchId: string): [number, number] {
  const dist = [0, 0, 1, 1, 1, 2, 2, 3];
  return [dist[randInt(matchId + "h", dist.length - 1)], dist[randInt(matchId + "a", dist.length - 1)]];
}
function pickScorer(teamId: string, seed: string): Player {
  const squad = playersByTeam.get(teamId)!;
  const weighted = squad.flatMap((p) =>
    Array(p.position === "FWD" ? 5 : p.position === "MID" ? 3 : p.position === "DEF" ? 1 : 0).fill(p),
  );
  return weighted[randInt(seed, weighted.length - 1)] ?? squad[0];
}
function makeGoals(matchId: string, teamId: string, n: number): GoalEvent[] {
  const goals: GoalEvent[] = [];
  for (let i = 0; i < n; i++) {
    const scorer = pickScorer(teamId, `${matchId}-${teamId}-${i}`);
    goals.push({
      playerId: scorer.id, apiPlayerId: scorer.apiId, playerName: scorer.name,
      minute: 5 + randInt(`${matchId}-${teamId}-${i}-min`, 84), teamId, ownGoal: false,
    });
  }
  return goals.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}

function buildEvents(m: Match): MatchEvent[] {
  const evs: MatchEvent[] = m.goals.map((g) => ({
    minute: g.minute, teamId: g.teamId, type: "GOAL",
    detail: g.ownGoal ? "Own Goal" : "Normal Goal", playerName: g.playerName, playerId: g.playerId,
    assistName: null,
  }));
  // a couple of cards + a sub per team for finished matches
  for (const teamId of [m.homeTeamId, m.awayTeamId]) {
    const squad = playersByTeam.get(teamId)!;
    const cards = randInt(`${m.id}-${teamId}-cards`, 2); // 0..2
    for (let i = 0; i < cards; i++) {
      const p = squad[randInt(`${m.id}-${teamId}-yc${i}`, squad.length - 1)];
      evs.push({ minute: 20 + randInt(`${m.id}-${teamId}-ycm${i}`, 65), teamId, type: "CARD",
        detail: "Yellow Card", playerName: p.name, playerId: p.id });
    }
    if (m.status === "FINISHED") {
      const off = squad[8 + randInt(`${m.id}-${teamId}-subo`, 2)];
      const on = squad[11 + randInt(`${m.id}-${teamId}-subi`, 2)];
      evs.push({ minute: 60 + randInt(`${m.id}-${teamId}-subm`, 25), teamId, type: "SUBST",
        detail: "Substitution", playerName: off.name, playerId: off.id, assistName: on.name });
    }
  }
  return evs.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}

function buildStats(m: Match): TeamStat[] {
  const possHome = 35 + randInt(`${m.id}-poss`, 30); // 35..65
  const mk = (teamId: string, poss: number, seed: string): TeamStat => ({
    teamId,
    items: [
      { type: "Ball Possession", value: `${poss}%` },
      { type: "Total Shots", value: 4 + randInt(`${seed}-ts`, 14) },
      { type: "Shots on Goal", value: 1 + randInt(`${seed}-sog`, 7) },
      { type: "Corner Kicks", value: randInt(`${seed}-ck`, 9) },
      { type: "Fouls", value: 5 + randInt(`${seed}-f`, 12) },
    ],
  });
  return [mk(m.homeTeamId, possHome, `${m.id}-h`), mk(m.awayTeamId, 100 - possHome, `${m.id}-a`)];
}

function buildLineup(teamId: string): Lineup {
  const squad = playersByTeam.get(teamId)!;
  const toLP = (p: Player): LineupPlayer => ({
    playerId: p.id, name: p.name, number: p.number ?? null,
    pos: p.position === "GK" ? "G" : p.position === "DEF" ? "D" : p.position === "MID" ? "M" : "F",
  });
  return {
    teamId, formation: "4-4-2", coach: null,
    startXI: squad.slice(0, 11).map(toLP), subs: squad.slice(11).map(toLP),
  };
}

function buildRatings(m: Match): PlayerRating[] {
  return [m.homeTeamId, m.awayTeamId].flatMap((teamId) =>
    playersByTeam.get(teamId)!.slice(0, 11).map((p) => ({
      playerId: p.id, name: p.name, teamId, number: p.number ?? null,
      rating: Number((6 + rand(`${m.id}-${p.id}-r`) * 2.8).toFixed(1)),
    })),
  );
}

// --- matches ---------------------------------------------------------------
const byGroup = new Map<GroupLetter, OFMatch[]>();
for (const m of groupMatches) {
  const g = groupOf(m);
  (byGroup.get(g) ?? byGroup.set(g, []).get(g)!).push(m);
}

const matches: Match[] = [];
for (const [group, ofMatches] of byGroup) {
  const sorted = [...ofMatches].sort((a, b) =>
    toIsoUtc(a.date, a.time).localeCompare(toIsoUtc(b.date, b.time)),
  );
  sorted.forEach((m, idx) => {
    const id = `${group}-${idx + 1}`;
    const matchday = Math.floor(idx / 2) + 1;
    const kickoff = toIsoUtc(m.date, m.time);
    const kickoffMs = Date.parse(kickoff);
    const homeTeamId = teamIdByName.get(m.team1)!;
    const awayTeamId = teamIdByName.get(m.team2)!;

    let status: Match["status"] = "SCHEDULED";
    if (kickoffMs + LIVE_WINDOW_MS < DEMO_NOW) status = "FINISHED";
    else if (kickoffMs <= DEMO_NOW) status = "LIVE";

    let homeGoals: number | null = null;
    let awayGoals: number | null = null;
    let goals: GoalEvent[] = [];
    let elapsed: number | null = null;

    if (status === "FINISHED") {
      if (m.score?.ft) [homeGoals, awayGoals] = m.score.ft;
      else [homeGoals, awayGoals] = synthScore(id);
      goals = [...makeGoals(id, homeTeamId, homeGoals), ...makeGoals(id, awayTeamId, awayGoals)];
    } else if (status === "LIVE") {
      elapsed = Math.min(85, Math.max(5, Math.round((DEMO_NOW - kickoffMs) / 60000)));
      const [fh, fa] = synthScore(id);
      homeGoals = Math.min(fh, Math.round((elapsed / 90) * fh + rand(id) * 0.4));
      awayGoals = Math.min(fa, Math.round((elapsed / 90) * fa + rand(id + "a") * 0.4));
      goals = [...makeGoals(id, homeTeamId, homeGoals), ...makeGoals(id, awayTeamId, awayGoals)]
        .filter((g) => (g.minute ?? 0) <= (elapsed ?? 0));
    }

    const match: Match = {
      id, apiId: null, group, matchday, kickoff, ground: m.ground ?? null,
      venue: VENUES[hash(id) % VENUES.length], homeTeamId, awayTeamId, status, elapsed,
      homeGoals, awayGoals, goals,
    };
    if (status === "FINISHED" || status === "LIVE") {
      match.events = buildEvents(match);
      match.stats = buildStats(match);
      match.lineups = [buildLineup(homeTeamId), buildLineup(awayTeamId)];
      match.ratings = buildRatings(match);
    }
    matches.push(match);
  });
}
matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id));

if (!matches.some((m) => m.status === "LIVE")) {
  const next = matches.find((m) => m.status === "SCHEDULED");
  if (next) {
    next.status = "LIVE";
    next.elapsed = 37;
    next.homeGoals = 1;
    next.awayGoals = 0;
    next.goals = makeGoals(next.id, next.homeTeamId, 1).filter((g) => (g.minute ?? 0) <= 37);
    next.events = buildEvents(next);
    next.stats = buildStats(next);
    next.lineups = [buildLineup(next.homeTeamId), buildLineup(next.awayTeamId)];
    next.ratings = buildRatings(next);
  }
}

const matchesFile: MatchesFile = {
  updatedAt: new Date().toISOString(), tournamentComplete: false, championTeamId: null, matches,
};

// --- standings -------------------------------------------------------------
const standings: StandingsFile = {
  updatedAt: new Date().toISOString(),
  groups: [...byGroup.keys()].sort().map((group) => {
    const gm = matches.filter((m) => m.group === group);
    const finishedResults: GroupResult[] = gm
      .filter((m) => m.status === "FINISHED" && m.homeGoals !== null && m.awayGoals !== null)
      .map((m) => ({ homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId, homeGoals: m.homeGoals!, awayGoals: m.awayGoals! }));
    const teamIds = teams.filter((t) => t.group === group).map((t) => t.id);
    const rows = computeGroupTable(teamIds, finishedResults, (id) => teamName.get(id) ?? id);
    const final = gm.length === MATCHES_PER_GROUP && gm.every((m) => m.status === "FINISHED");
    return { group, rows, final };
  }),
};

// --- stats.json (golden boot etc.) -----------------------------------------
const goalsByPlayer = new Map<string, number>();
for (const m of matches) for (const g of m.goals) if (!g.ownGoal && g.playerId)
  goalsByPlayer.set(g.playerId, (goalsByPlayer.get(g.playerId) ?? 0) + 1);
const playerById = new Map(players.map((p) => [p.id, p]));
const toStatLine = (playerId: string, value: number): PlayerStatLine => {
  const p = playerById.get(playerId)!;
  return {
    playerId, apiId: null, name: p.name, teamId: p.teamId, teamName: teamName.get(p.teamId) ?? "",
    photo: null, position: p.position, value, goals: value,
  };
};
const topScorers = [...goalsByPlayer.entries()]
  .sort((a, b) => b[1] - a[1]).slice(0, 20).map(([id, v]) => toStatLine(id, v));
// synthetic assists & cards leaders
const synthLeaders = (seed: string): PlayerStatLine[] =>
  [...players].sort((a, b) => rand(seed + a.id) - rand(seed + b.id)).slice(0, 12)
    .map((p, i) => ({ playerId: p.id, apiId: null, name: p.name, teamId: p.teamId,
      teamName: teamName.get(p.teamId) ?? "", photo: null, position: p.position, value: Math.max(1, 5 - Math.floor(i / 2)) }));
const statsFile: StatsFile = {
  updatedAt: new Date().toISOString(), topScorers,
  topAssists: synthLeaders("assist"), topCards: synthLeaders("cards"),
};

// --- injuries.json ---------------------------------------------------------
const injuryReasons = ["Knock", "Hamstring", "Suspended", "Illness", "Ankle"];
const injuryItems: InjuryItem[] = [...players]
  .sort((a, b) => rand("inj" + a.id) - rand("inj" + b.id)).slice(0, 10)
  .map((p) => ({
    playerId: p.id, apiId: null, name: p.name, teamId: p.teamId, teamName: teamName.get(p.teamId) ?? "",
    type: rand("injt" + p.id) > 0.5 ? "Missing Fixture" : "Questionable",
    reason: injuryReasons[hash("injr" + p.id) % injuryReasons.length],
  }));
const injuriesFile: InjuriesFile = { updatedAt: new Date().toISOString(), items: injuryItems };

// --- forecasts.json (upcoming matches) -------------------------------------
const forecastItems: Forecast[] = matches
  .filter((m) => m.status === "SCHEDULED")
  .map((m) => {
    const home = 25 + randInt(`${m.id}-fh`, 45);
    const draw = randInt(`${m.id}-fd`, Math.max(5, 90 - home));
    const away = Math.max(0, 100 - home - draw);
    const winnerHome = home >= away;
    return {
      matchId: m.id,
      winnerTeamId: winnerHome ? m.homeTeamId : m.awayTeamId,
      winnerName: teamName.get(winnerHome ? m.homeTeamId : m.awayTeamId) ?? null,
      advice: `${teamName.get(winnerHome ? m.homeTeamId : m.awayTeamId)} or draw`,
      percent: { home, draw, away },
    };
  });
const forecastsFile: ForecastsFile = { updatedAt: new Date().toISOString(), items: forecastItems };

console.log("Seeding from openfootball 2026:");
writeJson("roster.json", roster);
writeJson("matches.json", matchesFile);
writeJson("standings.json", standings);
writeJson("stats.json", statsFile);
writeJson("injuries.json", injuriesFile);
writeJson("forecasts.json", forecastsFile);
const counts = matches.reduce<Record<string, number>>((acc, m) => {
  acc[m.status] = (acc[m.status] ?? 0) + 1;
  return acc;
}, {});
const finalGroups = standings.groups.filter((g) => g.final).length;
console.log(
  `  ${teams.length} teams, ${players.length} players, ${matches.length} matches ` +
    `(${JSON.stringify(counts)}), ${finalGroups} groups final, ${topScorers.length} top scorers`,
);
