// The scoring engine. Pure: (state, teams) → every user's points with full
// line-by-line breakdowns. Only FINISHED fixtures and LOCKED predictions count.

import type {
  Euro28State,
  ETeam,
  EFixture,
  Outcome,
  UserScore,
  OutcomeScoreLine,
  ScorerScoreLine,
  TokenScoreLine,
  EPhase,
} from "../types";
import {
  BASE_OUTCOME,
  BASE_GOAL,
  BASE_TOKEN,
  OUTCOME_MULT,
  SCORER_MULT,
  TOKEN_MULT,
  BASE_CHAMPION,
  TOKEN_ALLOW_NEGATIVE,
  PHASES,
} from "../config";
import { championOf } from "./bracket";

export function actualOutcome(f: EFixture): Outcome | null {
  if (f.status !== "FINISHED" || f.homeGoals == null || f.awayGoals == null) return null;
  return f.homeGoals > f.awayGoals ? "H" : f.homeGoals < f.awayGoals ? "A" : "D";
}

/** Points preview for a correct outcome pick — shared by UI and engine so they can't drift. */
export function outcomePoints(phase: EPhase, odds: number): number {
  return Math.round(BASE_OUTCOME * OUTCOME_MULT[phase] * odds);
}

/** Points per goal for a scorer pick at given odds. */
export function scorerPointsPerGoal(phase: EPhase, odds: number): number {
  return Math.round(BASE_GOAL * SCORER_MULT[phase] * odds);
}

/** Champion payout for outright odds frozen at lock (missing snapshot ⇒ ×1), uncapped. */
export function championPoints(outrightOdds?: number): number {
  return Math.round(BASE_CHAMPION * (outrightOdds ?? 1));
}

/** Per-goal token rate in points for a phase, from a market rate factor (1 = even game). */
export function tokenRate(phase: EPhase, factor: number): number {
  return Math.round(BASE_TOKEN * TOKEN_MULT[phase] * factor);
}

/** Points for `count` tokens on RAW margin: +winRate per goal won by, −lossRate per goal
 * lost by, 0 on a draw. Rates are priced from the odds so both sides are EV-fair. */
export function tokenPoints(count: number, margin: number, winRate: number, lossRate: number): number {
  const gross = margin > 0 ? margin * winRate : margin * lossRate;
  const kept = TOKEN_ALLOW_NEGATIVE ? gross : Math.max(0, gross);
  return Math.round(count * kept);
}

export function computeScores(state: Euro28State, teams: ETeam[]): UserScore[] {
  void teams;
  const fixtures = state.fixtures;
  const fixtureById = new Map(fixtures.map((f) => [f.id, f]));
  const champion = championOf(fixtures);

  const scores: UserScore[] = state.users.map((u) => {
    const p = state.predictions[u.id] ?? { outcomes: {}, scorers: {}, tokens: {}, champion: null };

    // Rule 1/4: outcome picks.
    const outcomeLines: OutcomeScoreLine[] = [];
    for (const [fid, pred] of Object.entries(p.outcomes)) {
      if (!pred.locked || pred.odds == null) continue;
      const f = fixtureById.get(fid);
      if (!f) continue;
      const actual = actualOutcome(f);
      if (!actual) continue;
      const correct = actual === pred.pick;
      outcomeLines.push({
        fixtureId: fid,
        pick: pred.pick,
        correct,
        odds: pred.odds,
        points: correct ? outcomePoints(f.phase, pred.odds) : 0,
      });
    }

    // Rule 5: scorer picks — goals by picked forwards in that phase's finished fixtures.
    const scorerLines: ScorerScoreLine[] = [];
    for (const phase of PHASES) {
      const sp = p.scorers[phase];
      if (!sp?.locked || !sp.oddsByPlayer) continue;
      const goals = new Map<string, number>();
      for (const f of fixtures) {
        if (f.phase !== phase || f.status !== "FINISHED") continue;
        for (const s of f.scorers) goals.set(s.playerId, (goals.get(s.playerId) ?? 0) + s.count);
      }
      for (const pid of sp.playerIds) {
        const odds = sp.oddsByPlayer[pid] ?? 0;
        const g = goals.get(pid) ?? 0;
        scorerLines.push({
          phase,
          playerId: pid,
          goals: g,
          odds,
          points: g > 0 ? scorerPointsPerGoal(phase, odds) * g : 0,
        });
      }
    }

    // Rule 6: tokens — raw margin at the rates frozen at lock.
    const tokenLines: TokenScoreLine[] = [];
    for (const phase of PHASES) {
      const tp = p.tokens[phase];
      if (!tp?.locked || !tp.ratesByAssign) continue;
      for (const a of tp.assigns) {
        const f = fixtureById.get(a.fixtureId);
        if (!f || f.status !== "FINISHED" || f.homeGoals == null || f.awayGoals == null) continue;
        const netDiff = a.teamId === f.homeTeamId ? f.homeGoals - f.awayGoals : f.awayGoals - f.homeGoals;
        const rates = tp.ratesByAssign[`${a.fixtureId}:${a.teamId}`] ?? { win: 0, loss: 0 };
        tokenLines.push({
          phase,
          fixtureId: a.fixtureId,
          teamId: a.teamId,
          count: a.count,
          netDiff,
          winRate: rates.win,
          lossRate: rates.loss,
          points: tokenPoints(a.count, netDiff, rates.win, rates.loss),
        });
      }
    }

    // Rule 3: champion — base × outright odds frozen at lock, capped.
    const championCorrect = !!champion && !!p.champion?.locked && p.champion.teamId === champion;
    const championPts = championCorrect ? championPoints(p.champion?.outrightOdds) : 0;

    const sum = (xs: { points: number }[]) => xs.reduce((a, b) => a + b.points, 0);
    const outcomes = sum(outcomeLines);
    const scorers = sum(scorerLines);
    const tokens = sum(tokenLines);
    return {
      userId: u.id,
      name: u.name,
      outcomes,
      scorers,
      tokens,
      champion: championPts,
      total: outcomes + scorers + tokens + championPts,
      outcomeLines,
      scorerLines,
      tokenLines,
      championCorrect,
      rank: 0,
    };
  });

  const ranked = scores
    .filter((s) => !state.users.find((u) => u.id === s.userId)?.isAdmin)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  let lastTotal: number | null = null;
  let lastRank = 0;
  ranked.forEach((e, i) => {
    if (lastTotal === null || e.total !== lastTotal) {
      lastRank = i + 1;
      lastTotal = e.total;
    }
    e.rank = lastRank;
  });
  return scores;
}
