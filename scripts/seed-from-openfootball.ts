/**
 * Generate a realistic DEV/DEMO dataset (roster.json, matches.json, standings.json)
 * from the committed openfootball 2026 schedule. openfootball only fills in a handful
 * of real results, so we synthesise a plausible mid-tournament state (finished + live +
 * upcoming matches, synthetic squads with positions, synthetic goals) so every feature
 * of the site can be exercised offline. Real data is produced by fetch-data.ts at runtime.
 *
 * Run: npm run seed   (optionally BARNITO_DEMO_NOW=2026-06-22T19:30:00Z)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type {
  Roster, Team, Player, MatchesFile, Match, GoalEvent, StandingsFile,
  GroupLetter, Position, GoalMultiplier,
} from "@shared/types.js";
import { GOAL_MULTIPLIER, MATCHES_PER_GROUP } from "@shared/constants.js";
import { computeGroupTable, type GroupResult } from "./lib/standings.js";
import { REPO_ROOT, slug, toIsoUtc, writeJson, hash, rand, randInt } from "./lib/util.js";

const DEMO_NOW = new Date(process.env.BARNITO_DEMO_NOW ?? "2026-06-26T18:00:00Z").getTime();
const LIVE_WINDOW_MS = 2.5 * 60 * 60 * 1000; // a match kicked off within this window is "live"

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

// --- teams -----------------------------------------------------------------
const teamNames = new Map<string, GroupLetter>();
for (const m of groupMatches) {
  teamNames.set(m.team1, groupOf(m));
  teamNames.set(m.team2, groupOf(m));
}
const teams: Team[] = [...teamNames.entries()]
  .map(([name, group]) => ({ id: slug(name), name, group, apiId: null }))
  .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
const teamIdByName = new Map(teams.map((t) => [t.name, t.id]));

// --- synthetic squads ------------------------------------------------------
// Plausible-looking placeholder names; replaced by real squads from API-Football.
const SURNAMES = [
  "Silva", "Santos", "García", "Müller", "Rossi", "Dubois", "Kovač", "Nakamura", "Okafor",
  "Andersson", "Novák", "Hassan", "Petrov", "Costa", "Fernández", "Schmidt", "Bianchi",
  "Martin", "Horvat", "Tanaka", "Diallo", "Larsson", "Dvořák", "Mansour", "Ivanov",
  "Pereira", "López", "Wagner", "Romano", "Bernard", "Marković", "Saitō", "Mensah",
  "Nilsson", "Černý", "Khalil", "Sokolov", "Almeida", "Torres", "Becker", "Greco",
];
const INITIALS = ["A", "B", "C", "D", "E", "F", "G", "H", "J", "K", "L", "M", "N", "O", "P", "R", "S", "T"];
// squad template: position + how many of each (8 players, varied multipliers)
const SQUAD: Position[] = ["GK", "DEF", "DEF", "DEF", "MID", "MID", "FWD", "FWD"];

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

// --- matches ---------------------------------------------------------------
// Group internal matchday (1..3) by chronological order within each group.
const byGroup = new Map<GroupLetter, OFMatch[]>();
for (const m of groupMatches) {
  const g = groupOf(m);
  const arr = byGroup.get(g) ?? [];
  arr.push(m);
  byGroup.set(g, arr);
}

function synthScore(matchId: string): [number, number] {
  // weighted toward low scores
  const dist = [0, 0, 1, 1, 1, 2, 2, 3];
  const h = dist[randInt(matchId + "h", dist.length - 1)];
  const a = dist[randInt(matchId + "a", dist.length - 1)];
  return [h, a];
}

function pickScorer(teamId: string, seed: string): Player {
  const squad = playersByTeam.get(teamId)!;
  // weight forwards/mids higher as scorers
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
      playerId: scorer.id,
      apiPlayerId: scorer.apiId,
      playerName: scorer.name,
      minute: 5 + randInt(`${matchId}-${teamId}-${i}-min`, 84),
      teamId,
      ownGoal: false,
    });
  }
  return goals.sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
}

const matches: Match[] = [];
for (const [group, ofMatches] of byGroup) {
  const sorted = [...ofMatches].sort((a, b) =>
    toIsoUtc(a.date, a.time).localeCompare(toIsoUtc(b.date, b.time)),
  );
  sorted.forEach((m, idx) => {
    const id = `${group}-${idx + 1}`;
    const matchday = Math.floor(idx / 2) + 1; // 6 matches → 3 matchdays of 2
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
      // prefer the real openfootball result if present
      if (m.score?.ft) {
        [homeGoals, awayGoals] = m.score.ft;
      } else {
        [homeGoals, awayGoals] = synthScore(id);
      }
      goals = [...makeGoals(id, homeTeamId, homeGoals), ...makeGoals(id, awayTeamId, awayGoals)];
    } else if (status === "LIVE") {
      elapsed = Math.min(85, Math.max(5, Math.round((DEMO_NOW - kickoffMs) / 60000)));
      const [fh, fa] = synthScore(id);
      // partial score scaled by how far into the match we are
      homeGoals = Math.min(fh, Math.round((elapsed / 90) * fh + rand(id) * 0.4));
      awayGoals = Math.min(fa, Math.round((elapsed / 90) * fa + rand(id + "a") * 0.4));
      goals = [...makeGoals(id, homeTeamId, homeGoals), ...makeGoals(id, awayTeamId, awayGoals)]
        .filter((g) => (g.minute ?? 0) <= (elapsed ?? 0));
    }

    matches.push({
      id, apiId: null, group, matchday, kickoff, ground: m.ground ?? null,
      homeTeamId, awayTeamId, status, elapsed, homeGoals, awayGoals, goals,
    });
  });
}
matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id));

// Guarantee at least one LIVE match for the demo.
if (!matches.some((m) => m.status === "LIVE")) {
  const next = matches.find((m) => m.status === "SCHEDULED");
  if (next) {
    next.status = "LIVE";
    next.elapsed = 37;
    next.homeGoals = 1;
    next.awayGoals = 0;
    next.goals = makeGoals(next.id, next.homeTeamId, 1).filter((g) => (g.minute ?? 0) <= 37);
  }
}

const matchesFile: MatchesFile = {
  updatedAt: new Date().toISOString(),
  tournamentComplete: false,
  championTeamId: null,
  matches,
};

// --- standings -------------------------------------------------------------
const teamName = new Map(teams.map((t) => [t.id, t.name]));
const standings: StandingsFile = {
  updatedAt: new Date().toISOString(),
  groups: [...byGroup.keys()].sort().map((group) => {
    const gm = matches.filter((m) => m.group === group);
    const finishedResults: GroupResult[] = gm
      .filter((m) => m.status === "FINISHED" && m.homeGoals !== null && m.awayGoals !== null)
      .map((m) => ({
        homeTeamId: m.homeTeamId, awayTeamId: m.awayTeamId,
        homeGoals: m.homeGoals!, awayGoals: m.awayGoals!,
      }));
    const teamIds = teams.filter((t) => t.group === group).map((t) => t.id);
    const rows = computeGroupTable(teamIds, finishedResults, (id) => teamName.get(id) ?? id);
    const final = gm.length === MATCHES_PER_GROUP && gm.every((m) => m.status === "FINISHED");
    return { group, rows, final };
  }),
};

console.log("Seeding from openfootball 2026:");
writeJson("roster.json", roster);
writeJson("matches.json", matchesFile);
writeJson("standings.json", standings);
const counts = matches.reduce<Record<string, number>>((acc, m) => {
  acc[m.status] = (acc[m.status] ?? 0) + 1;
  return acc;
}, {});
const finalGroups = standings.groups.filter((g) => g.final).length;
console.log(
  `  ${teams.length} teams, ${players.length} players, ${matches.length} matches`,
  `(${JSON.stringify(counts)}), ${finalGroups} groups final`,
);
