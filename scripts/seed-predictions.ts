/**
 * Generate sample predictions.json for development/demo using fictional participants.
 * In production, predictions.json is produced by parse-predictions.ts from the Excel files.
 *
 * Run: npm run seed:predictions   (run `npm run seed` first to create roster/matches)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Roster, MatchesFile, PredictionsFile, Participant } from "@shared/types.js";
import { TOP_PLAYER_PICKS } from "@shared/constants.js";
import { DATA_DIR, slug, writeJson, randInt, rand } from "./lib/util.js";

const roster = JSON.parse(readFileSync(resolve(DATA_DIR, "roster.json"), "utf8")) as Roster;
const matchesFile = JSON.parse(readFileSync(resolve(DATA_DIR, "matches.json"), "utf8")) as MatchesFile;

const NAMES = [
  "Barney", "Mo", "Priya", "Diego", "Saoirse", "Kwame", "Yuki", "Lena", "Tomás", "Aisha",
];

// Players people tend to pick: weight attackers/midfielders, spread across teams.
const pickPool = roster.players
  .map((p) => ({
    p,
    weight: p.position === "FWD" ? 6 : p.position === "MID" ? 3 : p.position === "DEF" ? 1 : 0.5,
  }));

function predictScore(seed: string): [number, number] {
  const dist = [0, 0, 1, 1, 1, 2, 2, 3, 4];
  return [dist[randInt(seed + "h", dist.length - 1)], dist[randInt(seed + "a", dist.length - 1)]];
}

function pickPlayers(name: string): string[] {
  // deterministic weighted sample without replacement
  const scored = pickPool
    .map(({ p, weight }) => ({ id: p.id, key: rand(`${name}-${p.id}`) / weight }))
    .sort((a, b) => a.key - b.key);
  return scored.slice(0, TOP_PLAYER_PICKS).map((x) => x.id);
}

const strongTeams = roster.teams
  .filter((t) => ["brazil", "germany", "argentina", "france", "spain", "england", "portugal"]
    .includes(t.id))
  .map((t) => t.id);

const participants: Participant[] = NAMES.map((name) => {
  const id = slug(name);
  return {
    id,
    name,
    matchScores: matchesFile.matches.map((m) => {
      const [home, away] = predictScore(`${id}-${m.id}`);
      return { matchId: m.id, home, away };
    }),
    topPlayers: pickPlayers(name),
    champion: strongTeams.length
      ? strongTeams[randInt(id + "champ", strongTeams.length - 1)]
      : roster.teams[randInt(id + "champ", roster.teams.length - 1)].id,
  };
});

const file: PredictionsFile = { updatedAt: new Date().toISOString(), participants };
console.log("Seeding sample predictions:");
writeJson("predictions.json", file);
console.log(`  ${participants.length} participants, ${matchesFile.matches.length} match predictions each`);
