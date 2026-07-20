import type { EPhase } from "./types";

// ---------------------------------------------------------------------------
// Every tunable of the Barnito 28 rule set in one place. Change here, and the
// engine, the Rules page, and every points preview update together.
// ---------------------------------------------------------------------------

/** Base points for a correct outcome pick, before round & odds multipliers. */
export const BASE_OUTCOME = 10;
/** Base points per goal by a picked forward, before round & odds multipliers. */
export const BASE_GOAL = 10;
/** Base points per token per net goal, before round & odds multipliers. */
export const BASE_TOKEN = 10;

/** Rule 1: result multipliers, tuned so each round's total result points on offer
 * roughly DOUBLE (36/8/4/2/1 matches → expected totals 360/640/1280/2560/5120). */
export const OUTCOME_MULT: Record<EPhase, number> = { group: 1, r16: 8, qf: 32, sf: 128, final: 512 };

/** Rule 5: scorer multipliers — pick-games shrink 24/4/2/2/1. Tuned so that AFTER the
 * scorer market's structural edge (see SCORER_EV_FACTOR) the round's scorer pot doubles
 * and sits at roughly HALF the results pot (~324/324/648/1296/2592 expected). */
export const SCORER_MULT: Record<EPhase, number> = { group: 1, r16: 6, qf: 24, sf: 48, final: 192 };

/** Scorer picks pay PER GOAL at ANYTIME-scorer odds, and good strikers score multiples:
 * historically elite picks price ~1.4–1.9 anytime with ~0.8–1.0 xG/game, so odds ×
 * expected goals averages ≈ 1.35 rather than the 1.0 a fair single-payout market gives.
 * Used to calibrate the points-economy view and the multiplier tuning above. */
export const SCORER_EV_FACTOR = 1.35;

/** Rule 6: token multipliers — wallets shrink 12/8/4/2/1, tuned so the round's token
 * pot doubles and sits at roughly HALF the results pot (240/320/640/1280/2560). */
export const TOKEN_MULT: Record<EPhase, number> = { group: 2, r16: 4, qf: 16, sf: 64, final: 256 };

/** Rule 5: forwards-only scorer picks per phase. */
export const SCORER_PICKS: Record<EPhase, number> = { group: 8, r16: 4, qf: 2, sf: 2, final: 1 };

/** Rule 6: tokens per phase. */
export const TOKENS_BY_PHASE: Record<EPhase, number> = { group: 12, r16: 8, qf: 4, sf: 2, final: 1 };

/** Rule 3: champion pick is worth 2× the final round's outcome value, flat. */
export const CHAMPION_POINTS = 2 * BASE_OUTCOME * OUTCOME_MULT.final; // 10,240 — a real prize
/** If true, champion points multiply by the outright odds snapshotted at lock. */
export const CHAMPION_USES_ODDS = false;

/** If false, a backed team losing scores 0 instead of negative token points. */
export const TOKEN_ALLOW_NEGATIVE = true;

export const PHASES: EPhase[] = ["group", "r16", "qf", "sf", "final"];
export const PHASE_LABEL: Record<EPhase, string> = {
  group: "Group stage",
  r16: "Round of 16",
  qf: "Quarter-finals",
  sf: "Semi-finals",
  final: "Final",
};
export const PHASE_SHORT: Record<EPhase, string> = {
  group: "Groups",
  r16: "R16",
  qf: "QF",
  sf: "SF",
  final: "Final",
};

export const ADMIN_PIN = "2028";

/** localStorage key for the whole mock backend. Bump the suffix on breaking shape changes. */
export const STORAGE_KEY = "barnito-euro28:v1";
