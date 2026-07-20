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

/** Rule 1: each round's outcome points are worth 2× the last. */
export const OUTCOME_MULT: Record<EPhase, number> = { group: 1, r16: 2, qf: 4, sf: 8, final: 16 };

/** Rules 5–6: scorer picks and tokens scale ×4 per round (pick counts shrink). */
export const PICK_MULT: Record<EPhase, number> = { group: 1, r16: 4, qf: 16, sf: 64, final: 256 };

/** Rule 5: forwards-only scorer picks per phase. */
export const SCORER_PICKS: Record<EPhase, number> = { group: 8, r16: 4, qf: 2, sf: 2, final: 1 };

/** Rule 6: tokens per phase — 8 for the groups, then half the games per knockout round (final rounded up). */
export const TOKENS_BY_PHASE: Record<EPhase, number> = { group: 8, r16: 4, qf: 2, sf: 1, final: 1 };

/** Rule 3: champion pick is worth 2× the final round's outcome value, flat. */
export const CHAMPION_POINTS = 2 * BASE_OUTCOME * OUTCOME_MULT.final; // 320
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
