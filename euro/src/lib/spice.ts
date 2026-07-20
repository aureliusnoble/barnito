// Match spiciness: how much a game could swing the leaderboard, from everyone's
// LOCKED picks and tokens. For each possible goal margin we compute each player's
// points, take the spread (std) across players, weight by the margin's probability,
// and normalize by the round's typical pick value (base × round multiplier) so a
// group game and the final are rated on the same scale.

import type { Euro28State, ETeam, EFixture, Outcome } from "../types";
import { BASE_OUTCOME, OUTCOME_MULT } from "../config";
import { marginDistribution } from "./odds";
import { outcomePoints, tokenPoints } from "./scoring";

function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  return Math.sqrt(xs.reduce((a, x) => a + (x - m) ** 2, 0) / xs.length);
}

/** Round-relative spice: ~0 sleepy · ~1 one typical pick of spread · 2+ table-shaker. */
export function fixtureSpice(state: Euro28State, teamById: Map<string, ETeam>, fixture: EFixture): number {
  if (!fixture.homeTeamId || !fixture.awayTeamId) return 0;
  const home = teamById.get(fixture.homeTeamId);
  const away = teamById.get(fixture.awayTeamId);
  if (!home || !away) return 0;
  const users = state.users.filter((u) => !u.isAdmin);
  const at = Date.parse(fixture.kickoff);
  const margins = marginDistribution(fixture, home, away, home.id, at); // home-perspective

  let spice = 0;
  for (const [m, p] of margins) {
    const outcome: Outcome = m > 0 ? "H" : m < 0 ? "A" : "D";
    const pts = users.map((u) => {
      const preds = state.predictions[u.id];
      let total = 0;
      const op = preds?.outcomes[fixture.id];
      if (op?.locked && op.odds != null && op.pick === outcome) total += outcomePoints(fixture.phase, op.odds);
      const tp = preds?.tokens[fixture.phase];
      if (tp?.locked && tp.spreadByAssign) {
        for (const a of tp.assigns) {
          if (a.fixtureId !== fixture.id) continue;
          const marginForTeam = a.teamId === fixture.homeTeamId ? m : -m;
          total += tokenPoints(fixture.phase, a.count, marginForTeam, tp.spreadByAssign[`${a.fixtureId}:${a.teamId}`] ?? 0);
        }
      }
      return total;
    });
    spice += p * std(pts);
  }
  return spice / (BASE_OUTCOME * OUTCOME_MULT[fixture.phase]);
}

/** Chili heat 0–3 from the round-relative spice score. */
export function spiceLevel(spice: number): 0 | 1 | 2 | 3 {
  if (spice >= 1.2) return 3;
  if (spice >= 0.6) return 2;
  if (spice >= 0.25) return 1;
  return 0;
}
