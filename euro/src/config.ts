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
 * grow ~1.5× (36/8/4/2/1 matches → expected totals 360/560/800/1200/1800). */
export const OUTCOME_MULT: Record<EPhase, number> = { group: 1, r16: 7, qf: 20, sf: 60, final: 180 };

/** Rule 5: scorer multipliers — pick-games shrink 24/4/2/2/1. Tuned so that AFTER the
 * scorer market's structural edge (see SCORER_EV_FACTOR) the round's scorer pot grows
 * ~1.5× and sits at roughly HALF the results pot (~324/270/405/675/945 expected;
 * the group floor of ×1 makes groups the one rich-scorer anomaly). */
export const SCORER_MULT: Record<EPhase, number> = { group: 1, r16: 5, qf: 15, sf: 25, final: 70 };

/** Scorer picks pay PER GOAL at ANYTIME-scorer odds, and good strikers score multiples:
 * historically elite picks price ~1.4–1.9 anytime with ~0.8–1.0 xG/game, so odds ×
 * expected goals averages ≈ 1.35 rather than the 1.0 a fair single-payout market gives.
 * Used to calibrate the points-economy view and the multiplier tuning above. */
export const SCORER_EV_FACTOR = 1.35;

/** Rule 6: token multipliers — wallets shrink 12/8/4/2/1, tuned so the round's token
 * pot grows ~1.5× and sits at roughly HALF the results pot (240/320/400/600/900). */
export const TOKEN_MULT: Record<EPhase, number> = { group: 2, r16: 4, qf: 10, sf: 30, final: 90 };

/** Rule 5: forwards-only scorer picks per phase. */
export const SCORER_PICKS: Record<EPhase, number> = { group: 8, r16: 4, qf: 2, sf: 2, final: 1 };

/** Rule 6: tokens per phase. */
export const TOKENS_BY_PHASE: Record<EPhase, number> = { group: 12, r16: 8, qf: 4, sf: 2, final: 1 };

/** Rule 3: champion payout = BASE_CHAMPION × outright odds at lock-in (pre-tournament),
 * capped at CHAMPION_ODDS_CAP. Favourites (~×4.5–6.5) pay 1,800–2,600 — the podium-swing
 * zone; a dark horse maxes at 400 × 12 = 4,800 (~half a typical ~10k haul). Fair odds make
 * the expected value ≈ BASE_CHAMPION for every pick inside the cap, so no pick is 'correct'. */
export const BASE_CHAMPION = 400;
export const CHAMPION_ODDS_CAP = 12;

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
