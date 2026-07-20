import type { EPhase } from "./types";

// ---------------------------------------------------------------------------
// Every tunable of the Barnito 28 rule set in one place. Change here, and the
// engine, the Rules page, and every points preview update together.
// ---------------------------------------------------------------------------

/** Base points for a correct outcome pick, before round & odds multipliers. */
export const BASE_OUTCOME = 10;
/** Base points per goal by a picked forward, before round & odds multipliers. */
export const BASE_GOAL = 5;
/** Base points per token per net goal, before round & odds multipliers. */
export const BASE_TOKEN = 10;

/** Rule 1: result multipliers, tuned so each round's total result points on offer
 * grow ~1.5× (36/8/4/2/1 matches → expected totals 360/560/800/1200/1800). */
export const OUTCOME_MULT: Record<EPhase, number> = { group: 1, r16: 7, qf: 20, sf: 60, final: 180 };

/** Rule 5: scorer multipliers — pick-games shrink 36/8/4/2/1. Per-goal payouts are priced
 * at expected-goals odds (see lib/odds.ts scorerOdds), so a pick's EV per match is exactly
 * BASE_GOAL × multiplier and the round pots are 180/280/400/600/900 — exactly HALF the
 * results pot in every round. */
export const SCORER_MULT: Record<EPhase, number> = { group: 1, r16: 7, qf: 20, sf: 60, final: 180 };

/** Rule 6: token multipliers — wallets shrink 12/8/4/2/1. Tokens pay on the margin
 * RELATIVE to the frozen market spread (zero expectation both sides — pure edge), so
 * these scale the ± swing per round rather than an expected pot. */
export const TOKEN_MULT: Record<EPhase, number> = { group: 2, r16: 4, qf: 10, sf: 30, final: 90 };

/** Rule 5: forwards-only scorer picks per phase — half the games each round (like tokens). */
export const SCORER_PICKS: Record<EPhase, number> = { group: 12, r16: 8, qf: 4, sf: 2, final: 1 };

/** Rule 6: tokens per phase. */
export const TOKENS_BY_PHASE: Record<EPhase, number> = { group: 12, r16: 8, qf: 4, sf: 2, final: 1 };

/** Rule 3: champion payout = BASE_CHAMPION × outright odds at lock-in (pre-tournament),
 * uncapped. Favourites (~×4.5–6.5) pay ~2,300–3,300; a longshot that actually wins pays
 * its full odds. Fair odds make the expected value ≈ BASE_CHAMPION for every pick. */
export const BASE_CHAMPION = 500;

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
export const STORAGE_KEY = "barnito-euro28:v3";
