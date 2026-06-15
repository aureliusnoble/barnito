// AUTO-GENERATED from the repo source by scripts/sync-edge-shared.ts — do not edit.
import type { GroupLetter, Position, GoalMultiplier } from "./types.ts";

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

// Scorito scales every reward by the tournament phase. Group stage = base (×1); each knockout
// round multiplies match points (exact 45→90→135→180→225→270, outcome 30→60→…) and scorer
// points (the GOAL_MULTIPLIER above) by this factor.
export type Phase = "group" | "r32" | "r16" | "qf" | "sf" | "final";
export const ROUND_FACTOR: Record<Phase, number> = {
  group: 1,
  r32: 2,
  r16: 3,
  qf: 4,
  sf: 5,
  final: 6,
};
// Knockout rounds each get a fresh set of 4 top-scorer picks; the group stage gets 6.
export const SCORER_PICKS_BY_PHASE: Record<Phase, number> = {
  group: 6,
  r32: 4,
  r16: 4,
  qf: 4,
  sf: 4,
  final: 4,
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
