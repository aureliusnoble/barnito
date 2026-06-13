import type { GroupLetter, Position, GoalMultiplier } from "./types.js";

// --- Scoring rules ---------------------------------------------------------
export const POINTS_EXACT = 15; // exact scoreline bonus
export const POINTS_OUTCOME = 30; // correct result (W/D/L)
// Exact scoreline implies correct outcome, so a perfect prediction stacks: 15 + 30 = 45.
export const POINTS_EXACT_TOTAL = POINTS_EXACT + POINTS_OUTCOME; // 45
export const POINTS_PER_CORRECT_STANDING = 25; // per correct group position, locked when group final
export const POINTS_CHAMPION = 250; // awarded only at tournament end

export const GOAL_MULTIPLIER: Record<Position, GoalMultiplier> = {
  GK: 32,
  DEF: 32,
  MID: 16,
  FWD: 8,
};

// --- Tournament shape ------------------------------------------------------
export const GROUPS: GroupLetter[] = [
  "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L",
];
export const TEAMS_PER_GROUP = 4;
export const MATCHES_PER_GROUP = 6; // 4 teams round-robin
export const TOP_PLAYER_PICKS = 6;

// --- Spiciness ------------------------------------------------------------
// Candidate scorelines considered when estimating how much a result could swing
// the leaderboard. 0..MAX each side keeps it bounded and fast.
export const SPICY_MAX_GOALS = 4;
