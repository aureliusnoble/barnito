/**
 * Read roster/matches/predictions/standings from public/data and write scores.json.
 * Pure logic lives in scripts/lib/scoring.ts (unit-tested). Run: npm run score
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type {
  Roster, MatchesFile, PredictionsFile, StandingsFile,
} from "@shared/types.js";
import { computeScores } from "./lib/scoring.js";
import { DATA_DIR, writeJson } from "./lib/util.js";

function load<T>(file: string, fallback: T): T {
  const path = resolve(DATA_DIR, file);
  if (!existsSync(path)) {
    console.warn(`  ! ${file} missing — using empty fallback`);
    return fallback;
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

const roster = load<Roster>("roster.json", { updatedAt: "", teams: [], players: [] });
const matches = load<MatchesFile>("matches.json", {
  updatedAt: "", tournamentComplete: false, championTeamId: null, matches: [],
});
const predictions = load<PredictionsFile>("predictions.json", { updatedAt: "", participants: [] });
const standings = load<StandingsFile>("standings.json", { updatedAt: "", groups: [] });

console.log("Computing scores:");
const scores = computeScores({ roster, matches, predictions, standings });
writeJson("scores.json", scores);
console.log(
  `  ${scores.leaderboard.length} participants ranked, ` +
    `${scores.perMatch.length} matches, ${scores.spiciness.length} upcoming spicy games`,
);
if (scores.leaderboard.length) {
  const top = scores.leaderboard[0];
  console.log(`  leader: ${top.name} with ${top.total} pts`);
}
