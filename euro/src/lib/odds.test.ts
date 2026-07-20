// Tests for the mock odds engine. Everything is synthetic and deterministic:
// same (fixture, teams, time) must always price the same, so these tests can
// assert exact equality where the engine promises it.

import { describe, it, expect } from "vitest";
import type { EFixture, EPhase, ETeam, EPlayer, Outcome } from "../types";
import { normalizeProbs, outcomeOdds, scorerOdds, teamWinOdds, tokenMarket } from "./odds";

// ---------------------------------------------------------------------------
// Synthetic builders (no imports from data/*).
// ---------------------------------------------------------------------------

function team(id: string, rating: number): ETeam {
  return {
    id,
    name: id.toUpperCase(),
    code: id.slice(0, 3).toUpperCase(),
    group: "A",
    rating,
    color: "#8bff00",
    flag: "🏳️",
  };
}

function player(id: string, teamId: string, rating: number): EPlayer {
  return { id, name: id, teamId, rating };
}

function fixture(id: string, phase: EPhase, homeTeamId: string, awayTeamId: string): EFixture {
  return {
    id,
    phase,
    kickoff: "2028-06-09T14:00:00.000Z",
    venue: "Wembley",
    city: "London",
    homeTeamId,
    awayTeamId,
    status: "SCHEDULED",
    homeGoals: null,
    awayGoals: null,
    scorers: [],
  };
}

const HOME = team("alpha", 1900);
const AWAY = team("gamma", 1750);
const FX = fixture("g-A1", "group", HOME.id, AWAY.id);
const T0 = Date.UTC(2028, 5, 9, 12, 0, 0); // 9 June 2028 12:00Z — tournament-ish time
const HOUR = 3600_000;
const OUTCOMES: readonly Outcome[] = ["H", "D", "A"];

// Mirror of the engine's 2dp fair-odds rounding, used to cross-check odds ≈ 1/prob.
const fair = (p: number): number => Math.round((1 / p) * 100) / 100;

// ---------------------------------------------------------------------------
// outcomeOdds
// ---------------------------------------------------------------------------

describe("outcomeOdds — determinism", () => {
  it("returns identical prices for the same fixture/teams/time", () => {
    const a = outcomeOdds(FX, HOME, AWAY, T0);
    const b = outcomeOdds(FX, HOME, AWAY, T0);
    expect(b).toStrictEqual(a);
  });

  it("depends on input values, not object identity", () => {
    // Fresh literals with the same ids/ratings must price identically.
    const a = outcomeOdds(FX, HOME, AWAY, T0);
    const b = outcomeOdds(
      fixture("g-A1", "group", "alpha", "gamma"),
      team("alpha", 1900),
      team("gamma", 1750),
      T0,
    );
    expect(b).toStrictEqual(a);
  });

  it("prices different fixture ids differently (per-market drift seed)", () => {
    const a = outcomeOdds(FX, HOME, AWAY, T0);
    const b = outcomeOdds(fixture("g-A2", "group", HOME.id, AWAY.id), HOME, AWAY, T0);
    expect(b.probs).not.toStrictEqual(a.probs);
  });
});

describe("outcomeOdds — probabilities and odds shape", () => {
  const hours = [0, 5, 11, 17, 23];

  it("probs are a valid distribution summing to ~1 at any time", () => {
    for (const h of hours) {
      const { probs } = outcomeOdds(FX, HOME, AWAY, T0 + h * HOUR);
      const sum = probs.H + probs.D + probs.A;
      expect(sum).toBeCloseTo(1, 12);
      for (const k of OUTCOMES) {
        expect(probs[k]).toBeGreaterThan(0);
        expect(probs[k]).toBeLessThan(1);
      }
    }
  });

  it("decimal odds ≈ 1/prob (fair, 2dp rounding)", () => {
    for (const h of hours) {
      const { probs, odds } = outcomeOdds(FX, HOME, AWAY, T0 + h * HOUR);
      for (const k of OUTCOMES) {
        expect(odds[k]).toBe(fair(probs[k]));
        // Rounding to 2dp keeps odds within half a cent of the true inverse.
        expect(Math.abs(odds[k] - 1 / probs[k])).toBeLessThanOrEqual(0.005 + 1e-12);
      }
    }
  });

  it("the stronger side is favourite over the drift cycle", () => {
    // 150 Elo points of gap dwarfs the ±9% drift at every hour of the cycle.
    for (let h = 0; h <= 26; h += 2) {
      const { probs } = outcomeOdds(FX, HOME, AWAY, T0 + h * HOUR);
      expect(probs.H).toBeGreaterThan(probs.A);
    }
  });
});

describe("outcomeOdds — drift over time", () => {
  it("moves probabilities materially across hours", () => {
    const base = outcomeOdds(FX, HOME, AWAY, T0);
    let maxDelta = 0;
    for (const h of [1, 3, 6, 9, 13, 17, 21]) {
      const later = outcomeOdds(FX, HOME, AWAY, T0 + h * HOUR);
      for (const k of OUTCOMES) {
        maxDelta = Math.max(maxDelta, Math.abs(later.probs[k] - base.probs[k]));
      }
    }
    expect(maxDelta).toBeGreaterThan(0.01);
  });

  it("changes the quoted 2dp odds at some point in the cycle", () => {
    const base = outcomeOdds(FX, HOME, AWAY, T0);
    const changed = [1, 3, 6, 9, 13, 17, 21].some((h) => {
      const later = outcomeOdds(FX, HOME, AWAY, T0 + h * HOUR);
      return OUTCOMES.some((k) => later.odds[k] !== base.odds[k]);
    });
    expect(changed).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// scorerOdds
// ---------------------------------------------------------------------------

describe("scorerOdds", () => {
  it("is deterministic for the same player/team/phase/time", () => {
    const p = player("alpha-nine", HOME.id, 88);
    const a = scorerOdds(p, HOME, "group", T0);
    const b = scorerOdds(player("alpha-nine", HOME.id, 88), team("alpha", 1900), "group", T0);
    expect(b).toStrictEqual(a);
  });

  it("keeps prob within [0.03, 0.75] across ratings, team strengths and time", () => {
    for (const rating of [60, 67, 74, 81, 88, 95, 99]) {
      for (const teamRating of [1500, 1650, 1800, 1950, 2100]) {
        const t = team(`t${teamRating}`, teamRating);
        for (const h of [0, 7, 13, 19, 25]) {
          for (const phase of ["group", "qf", "final"]) {
            const { prob, odds } = scorerOdds(player(`p${rating}`, t.id, rating), t, phase, T0 + h * HOUR);
            expect(prob).toBeGreaterThanOrEqual(0.03);
            expect(prob).toBeLessThanOrEqual(0.75);
            // Per-goal fair pricing: odds = 1/λ with λ = −ln(1−p) — so paying per
            // goal at these odds gives every pick an identical expected return.
            expect(odds).toBe(fair(-Math.log(1 - prob)));
          }
        }
      }
    }
  });

  it("gives a clearly higher-rated player a higher prob (same team, same time)", () => {
    // 15-rating gaps swamp the ±9% per-player drift, so ordering must hold.
    for (const t of [team("alpha", 1900), team("delta", 1600)]) {
      for (const h of [0, 6, 13, 20]) {
        const at = T0 + h * HOUR;
        const low = scorerOdds(player("striker-low", t.id, 65), t, "group", at);
        const mid = scorerOdds(player("striker-mid", t.id, 80), t, "group", at);
        const high = scorerOdds(player("striker-high", t.id, 95), t, "group", at);
        expect(mid.prob).toBeGreaterThan(low.prob);
        expect(high.prob).toBeGreaterThan(mid.prob);
        // Higher prob ⇒ shorter decimal odds.
        expect(mid.odds).toBeLessThan(low.odds);
        expect(high.odds).toBeLessThan(mid.odds);
      }
    }
  });

  it("drifts over hours for the same player", () => {
    const p = player("alpha-nine", HOME.id, 88);
    const base = scorerOdds(p, HOME, "group", T0).prob;
    let maxDelta = 0;
    for (const h of [1, 4, 9, 13, 18, 22]) {
      maxDelta = Math.max(maxDelta, Math.abs(scorerOdds(p, HOME, "group", T0 + h * HOUR).prob - base));
    }
    expect(maxDelta).toBeGreaterThan(0.005);
  });
});

// ---------------------------------------------------------------------------
// teamWinOdds
// ---------------------------------------------------------------------------

describe("teamWinOdds", () => {
  it("matches outcomeOdds' H market for the home team and A market for the away team", () => {
    for (const h of [0, 6, 13, 21]) {
      const at = T0 + h * HOUR;
      const full = outcomeOdds(FX, HOME, AWAY, at);
      const homeSide = teamWinOdds(FX, HOME, AWAY, HOME.id, at);
      const awaySide = teamWinOdds(FX, HOME, AWAY, AWAY.id, at);
      expect(homeSide.prob).toBe(full.probs.H);
      expect(homeSide.odds).toBe(full.odds.H);
      expect(awaySide.prob).toBe(full.probs.A);
      expect(awaySide.odds).toBe(full.odds.A);
    }
  });

  it("home and away win probs stay consistent with the draw as the remainder", () => {
    const full = outcomeOdds(FX, HOME, AWAY, T0);
    const homeSide = teamWinOdds(FX, HOME, AWAY, HOME.id, T0);
    const awaySide = teamWinOdds(FX, HOME, AWAY, AWAY.id, T0);
    expect(homeSide.prob + awaySide.prob + full.probs.D).toBeCloseTo(1, 12);
  });
});


// ---------------------------------------------------------------------------
// normalizeProbs — the overround guard for real bookmaker odds
// ---------------------------------------------------------------------------

describe("normalizeProbs", () => {
  it("rescales a margined book (sum > 1) to sum exactly 1, preserving ratios", () => {
    // A typical 1X2 book at ~110% overround: implied probs from 1/odds.
    const raw = { H: 1 / 1.8, D: 1 / 3.4, A: 1 / 4.2 }; // sums ≈ 1.088
    const fairP = normalizeProbs(raw);
    const sum = fairP.H + fairP.D + fairP.A;
    expect(Math.abs(sum - 1)).toBeLessThan(1e-12);
    expect(fairP.H / fairP.A).toBeCloseTo(raw.H / raw.A, 12); // relative beliefs unchanged
    expect(fairP.H).toBeLessThan(raw.H); // every prob shrinks — no pick is EV-taxed vs another
  });

  it("leaves an already-fair book unchanged", () => {
    const raw = { H: 0.5, D: 0.3, A: 0.2 };
    const out = normalizeProbs(raw);
    expect(out.H).toBeCloseTo(0.5, 12);
    expect(out.D).toBeCloseTo(0.3, 12);
    expect(out.A).toBeCloseTo(0.2, 12);
  });

  it("outcomeOdds routes through it: implied probs of the quoted odds sum to ~1", () => {
    const f = fixture("g-A1", "group", HOME.id, AWAY.id);
    const o = outcomeOdds(f, HOME, AWAY, T0);
    const impliedSum = 1 / o.odds.H + 1 / o.odds.D + 1 / o.odds.A;
    expect(Math.abs(impliedSum - 1)).toBeLessThan(0.02); // 2dp rounding only
  });
});


// ---------------------------------------------------------------------------
// tokenMarket — asymmetric per-goal rates priced from the odds
// ---------------------------------------------------------------------------

describe("tokenMarket", () => {
  it("prices raw-margin tokens EV-fair on both sides, favourite earning less/risking more", () => {
    const f = fixture("g-A1", "group", HOME.id, AWAY.id); // HOME is the stronger side
    const fav = tokenMarket(f, HOME, AWAY, HOME.id, T0);
    const dog = tokenMarket(f, HOME, AWAY, AWAY.id, T0);
    for (const m of [fav, dog]) {
      // EV = winFactor×P(win)×E[m|win] − lossFactor×P(loss)×E[m|loss]; the margin
      // means cancel, so fairness reduces to winFactor×winProb = lossFactor×lossProb.
      expect(Math.abs(m.winFactor * m.winProb - m.lossFactor * m.lossProb)).toBeLessThan(1e-9);
      // Normalization bounds every rate: the two factors always sum to 2.
      expect(m.winFactor + m.lossFactor).toBeCloseTo(2, 9);
      expect(m.winFactor).toBeGreaterThan(0);
      expect(m.lossFactor).toBeGreaterThan(0);
    }
    // Favourite: earns less per goal won, risks more per goal lost. Dog mirrored.
    expect(fav.winFactor).toBeLessThan(1);
    expect(fav.lossFactor).toBeGreaterThan(1);
    expect(dog.winFactor).toBeGreaterThan(1);
    expect(dog.winFactor).toBeCloseTo(fav.lossFactor, 9);
    expect(dog.lossFactor).toBeCloseTo(fav.winFactor, 9);
  });
});
