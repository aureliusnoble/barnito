// Tests for the scoring engine: unit math for the three point formulas (exact,
// derived from config constants — never bare magic numbers) and an end-to-end
// computeScores run over a small synthetic tournament state.

import { describe, it, expect } from "vitest";
import type { EFixture, ETeam, EUser, Euro28State, UserPredictions, UserScore } from "../types";
import {
  actualOutcome,
  computeScores,
  outcomePoints,
  scorerPointsPerGoal,
  tokenPoints,
} from "./scoring";
import {
  BASE_OUTCOME,
  BASE_GOAL,
  BASE_TOKEN,
  OUTCOME_MULT,
  SCORER_EV_FACTOR,
  SCORER_MULT,
  TOKEN_MULT,
  CHAMPION_POINTS,
  CHAMPION_USES_ODDS,
  TOKEN_ALLOW_NEGATIVE,
  PHASES,
} from "../config";

// ---------------------------------------------------------------------------
// Synthetic builders (no imports from data/*).
// ---------------------------------------------------------------------------

function team(id: string, rating: number, group: ETeam["group"]): ETeam {
  return { id, name: id, code: id.slice(0, 3).toUpperCase(), group, rating, color: "#8bff00", flag: "🏳️" };
}

function user(id: string, isAdmin = false): EUser {
  return { id, name: id, isAdmin, emoji: "🎯" };
}

function fx(over: Partial<EFixture> & Pick<EFixture, "id" | "phase">): EFixture {
  return {
    kickoff: "2028-06-09T14:00:00.000Z",
    venue: "Wembley",
    city: "London",
    homeTeamId: null,
    awayTeamId: null,
    status: "SCHEDULED",
    homeGoals: null,
    awayGoals: null,
    scorers: [],
    ...over,
  };
}

function scoreOf(results: UserScore[], userId: string): UserScore {
  const s = results.find((r) => r.userId === userId);
  if (!s) throw new Error(`no score computed for ${userId}`);
  return s;
}

// ---------------------------------------------------------------------------
// Unit math: the three formulas, exactly as configured.
// ---------------------------------------------------------------------------

describe("config sanity (the points economy the multipliers encode)", () => {
  // Fair odds cancel probability in expectation, so a round's expected pot per
  // category = count × base × multiplier. The design: every category's pot
  // doubles each knockout round, and results carry ~2× scorers and tokens.
  const MATCHES = { group: 36, r16: 8, qf: 4, sf: 2, final: 1 } as const;
  const PICK_GAMES = { group: 24, r16: 4, qf: 2, sf: 2, final: 1 } as const; // picks × games-per-team
  const WALLETS = { group: 12, r16: 8, qf: 4, sf: 2, final: 1 } as const;
  const pot = (p: (typeof PHASES)[number]) => ({
    results: MATCHES[p] * BASE_OUTCOME * OUTCOME_MULT[p],
    // Scorer picks pay per goal at anytime odds — structurally ~1.35× a fair payout.
    scorers: PICK_GAMES[p] * BASE_GOAL * SCORER_MULT[p] * SCORER_EV_FACTOR,
    tokens: WALLETS[p] * BASE_TOKEN * TOKEN_MULT[p],
  });

  it("every category's pot doubles each knockout round", () => {
    for (let i = 2; i < PHASES.length; i++) {
      const prev = pot(PHASES[i - 1]);
      const cur = pot(PHASES[i]);
      expect(cur.results).toBe(2 * prev.results);
      expect(cur.scorers).toBe(2 * prev.scorers);
      expect(cur.tokens).toBe(2 * prev.tokens);
    }
  });

  it("results are worth roughly double scorers and tokens every round", () => {
    for (const p of PHASES) {
      const { results, scorers, tokens } = pot(p);
      // Group is the one anomaly: 8 picks × 3 games at the ×1 floor can't go lower,
      // so group scorers land near parity with results instead of half.
      if (p !== "group") {
        expect(results / scorers).toBeGreaterThanOrEqual(1.5);
        expect(results / scorers).toBeLessThanOrEqual(2.1);
      }
      expect(results / tokens).toBeGreaterThanOrEqual(1.25);
      expect(results / tokens).toBeLessThanOrEqual(2);
    }
  });

  it("champion pick is worth 2× the final's outcome base — a significant flat prize", () => {
    expect(CHAMPION_POINTS).toBe(2 * BASE_OUTCOME * OUTCOME_MULT.final);
    expect(CHAMPION_POINTS).toBe(10240); // 2 × 10 × 512
    expect(CHAMPION_USES_ODDS).toBe(false);
    expect(TOKEN_ALLOW_NEGATIVE).toBe(true);
  });
});

describe("outcomePoints", () => {
  it("is BASE_OUTCOME × OUTCOME_MULT[phase] × odds, rounded", () => {
    for (const phase of PHASES) {
      // At odds 1.0 the formula collapses to base × round multiplier.
      expect(outcomePoints(phase, 1)).toBe(BASE_OUTCOME * OUTCOME_MULT[phase]);
    }
    // Worked example: 10 base × 32 (QF) × 7.14 odds = 2284.8 → 2285.
    expect(outcomePoints("qf", 7.14)).toBe(Math.round(BASE_OUTCOME * OUTCOME_MULT.qf * 7.14));
    expect(outcomePoints("qf", 7.14)).toBe(2285);
  });

  it("rounds to the nearest integer (halves round up)", () => {
    // 10 × 1 × 1.25 = 12.5 exactly (1.25 is dyadic, no float fuzz) → 13.
    expect(outcomePoints("group", 1.25)).toBe(13);
    // 10 × 8 (R16) × 1.33 = 106.4 → 106.
    expect(outcomePoints("r16", 1.33)).toBe(106);
    // 10 × 128 (SF) × 7.14 = 9139.2 → 9139 (rounds down).
    expect(outcomePoints("sf", 7.14)).toBe(9139);
  });
});

describe("scorerPointsPerGoal", () => {
  it("is BASE_GOAL × SCORER_MULT[phase] × odds, rounded", () => {
    for (const phase of PHASES) {
      expect(scorerPointsPerGoal(phase, 1)).toBe(BASE_GOAL * SCORER_MULT[phase]);
    }
    // 10 × 6 (R16) × 1.87 = 112.2 → 112.
    expect(scorerPointsPerGoal("r16", 1.87)).toBe(Math.round(BASE_GOAL * SCORER_MULT.r16 * 1.87));
    expect(scorerPointsPerGoal("r16", 1.87)).toBe(112);
    // 10 × 192 (final) × 5.5 = 10560 exactly.
    expect(scorerPointsPerGoal("final", 5.5)).toBe(10560);
  });
});

describe("tokenPoints", () => {
  it("is BASE_TOKEN × count × netDiff × TOKEN_MULT[phase] × odds, rounded", () => {
    // 10 × 3 tokens × +2 diff × 2 (group) × 1.8 = 216.
    expect(tokenPoints("group", 3, 2, 1.8)).toBe(Math.round(BASE_TOKEN * 3 * 2 * TOKEN_MULT.group * 1.8));
    expect(tokenPoints("group", 3, 2, 1.8)).toBe(216);
    // 10 × 1 × +3 × 64 (SF) × 2.5 = 4800.
    expect(tokenPoints("sf", 1, 3, 2.5)).toBe(BASE_TOKEN * 1 * 3 * TOKEN_MULT.sf * 2.5);
  });

  it("goes NEGATIVE when the backed team loses (TOKEN_ALLOW_NEGATIVE)", () => {
    // 10 × 1 × −2 × 16 (QF) × 1.5 = −480 when negatives are allowed, else 0.
    const expected = TOKEN_ALLOW_NEGATIVE ? Math.round(BASE_TOKEN * 1 * -2 * TOKEN_MULT.qf * 1.5) : 0;
    expect(tokenPoints("qf", 1, -2, 1.5)).toBe(expected);
    expect(tokenPoints("qf", 1, -2, 1.5)).toBe(-480); // 10 × 1 × −2 × 16 (QF) × 1.5
    // 10 × 2 × −3 × 2 (group) × 2.5 = −300.
    expect(tokenPoints("group", 2, -3, 2.5)).toBe(-300);
  });

  it("scores 0 for a level match or zero tokens", () => {
    expect(tokenPoints("group", 4, 0, 3.2)).toBe(0);
    expect(tokenPoints("final", 0, 5, 3.2)).toBe(0);
  });

  it("rounds halves toward +∞ (JS Math.round), so ±12.5 is asymmetric", () => {
    // 10 × 1 × ±1 × 2 (group) × 1.125 = ±22.5 exactly → +23 but −22.
    expect(tokenPoints("group", 1, 1, 1.125)).toBe(23);
    expect(tokenPoints("group", 1, -1, 1.125)).toBe(-22);
  });
});

describe("actualOutcome", () => {
  it("reads the final (after-extra-time) result of finished fixtures only", () => {
    expect(actualOutcome(fx({ id: "a", phase: "group", status: "FINISHED", homeGoals: 2, awayGoals: 0 }))).toBe("H");
    expect(actualOutcome(fx({ id: "b", phase: "group", status: "FINISHED", homeGoals: 0, awayGoals: 2 }))).toBe("A");
    expect(actualOutcome(fx({ id: "c", phase: "group", status: "FINISHED", homeGoals: 1, awayGoals: 1 }))).toBe("D");
    expect(actualOutcome(fx({ id: "d", phase: "group" }))).toBeNull(); // still SCHEDULED
    expect(actualOutcome(fx({ id: "e", phase: "group", status: "FINISHED" }))).toBeNull(); // no score entered
  });

  it("a knockout draw stays 'D' even when penalties decide who advances", () => {
    const final = fx({
      id: "final",
      phase: "final",
      status: "FINISHED",
      homeTeamId: "alpha",
      awayTeamId: "gamma",
      homeGoals: 1,
      awayGoals: 1,
      penWinnerTeamId: "alpha",
    });
    expect(actualOutcome(final)).toBe("D");
  });
});

// ---------------------------------------------------------------------------
// End-to-end: computeScores over a synthetic mini-tournament.
//
// Fixtures: two finished group games, one scheduled group game, and a finished
// final that is 1–1 after extra time with alpha winning the shootout (⇒ champion).
// ---------------------------------------------------------------------------

const teams: ETeam[] = [
  team("alpha", 1900, "A"),
  team("beta", 1800, "A"),
  team("gamma", 1750, "B"),
  team("delta", 1600, "B"),
];

const fixtures: EFixture[] = [
  fx({
    id: "g-A1", phase: "group", group: "A", status: "FINISHED",
    homeTeamId: "alpha", awayTeamId: "beta", homeGoals: 2, awayGoals: 0,
    scorers: [{ playerId: "p-alpha-9", count: 2 }],
  }),
  fx({
    id: "g-B1", phase: "group", group: "B", status: "FINISHED",
    homeTeamId: "gamma", awayTeamId: "delta", homeGoals: 1, awayGoals: 1,
  }),
  // Locked picks exist on this one, but it hasn't been played — must score 0.
  fx({ id: "g-A3", phase: "group", group: "A", homeTeamId: "alpha", awayTeamId: "beta" }),
  // 1–1 after extra time; alpha lifts the trophy on penalties.
  fx({
    id: "final", phase: "final", status: "FINISHED",
    homeTeamId: "alpha", awayTeamId: "gamma", homeGoals: 1, awayGoals: 1,
    penWinnerTeamId: "alpha",
    scorers: [{ playerId: "p-alpha-9", count: 1 }], // final goal must NOT count toward group scorer sets
  }),
];

// Locked-in odds (chosen so every product is float-safe for Math.round).
const O = {
  aliceGA1: 1.8, aliceGB1: 2.4, aliceGA3: 2.0, aliceFinal: 3.6,
  aliceScorerHot: 2.2, aliceScorerCold: 3.0,
  aliceTokA1: 1.7, aliceTokB1: 2.9, aliceTokA3: 2.0,
  bobGB1: 3.1, bobFinal: 3.0, bobTokA1: 3.4,
  adminGA1: 1.8, adminFinal: 2.8,
} as const;

const predictions: Record<string, UserPredictions> = {
  alice: {
    outcomes: {
      "g-A1": { pick: "H", locked: true, lockedAt: "2028-06-08T10:00:00.000Z", odds: O.aliceGA1 }, // correct
      "g-B1": { pick: "H", locked: true, odds: O.aliceGB1 }, // wrong (it was a draw)
      "g-A3": { pick: "H", locked: true, odds: O.aliceGA3 }, // fixture unfinished → no score
      final: { pick: "D", locked: true, odds: O.aliceFinal }, // correct: after-extra-time draw pays even with pens
    },
    scorers: {
      group: {
        playerIds: ["p-alpha-9", "p-beta-7"],
        locked: true,
        oddsByPlayer: { "p-alpha-9": O.aliceScorerHot, "p-beta-7": O.aliceScorerCold },
      },
    },
    tokens: {
      group: {
        assigns: [
          { fixtureId: "g-A1", teamId: "alpha", count: 2 }, // netDiff +2
          { fixtureId: "g-B1", teamId: "delta", count: 1 }, // netDiff 0
          { fixtureId: "g-A3", teamId: "alpha", count: 1 }, // unfinished → no score
        ],
        locked: true,
        oddsByAssign: { "g-A1:alpha": O.aliceTokA1, "g-B1:delta": O.aliceTokB1, "g-A3:alpha": O.aliceTokA3 },
      },
    },
    champion: { teamId: "alpha", locked: true, outrightOdds: 6.0 }, // correct (pens) — flat points, odds ignored
  },
  bob: {
    outcomes: {
      "g-A1": { pick: "H", locked: false }, // DRAFT — would be correct, must score 0 and produce no line
      "g-B1": { pick: "D", locked: true, odds: O.bobGB1 }, // correct
      final: { pick: "A", locked: true, odds: O.bobFinal }, // wrong (it was a draw after extra time)
    },
    scorers: {
      group: { playerIds: ["p-alpha-9"], locked: false }, // draft set — never scores
    },
    tokens: {
      group: {
        assigns: [{ fixtureId: "g-A1", teamId: "beta", count: 3 }], // backed the 0–2 loser → negative
        locked: true,
        oddsByAssign: { "g-A1:beta": O.bobTokA1 },
      },
    },
    champion: { teamId: "gamma", locked: true }, // reached the final, drew after extra time, lost pens → 0
  },
  admin: {
    outcomes: {
      "g-A1": { pick: "H", locked: true, odds: O.adminGA1 }, // correct — admin scores, but never ranks
      // Alpha "won" the final on penalties, but the result after extra time was a draw → H pays nothing.
      final: { pick: "H", locked: true, odds: O.adminFinal },
    },
    scorers: {},
    tokens: {},
    champion: null,
  },
  cara: {
    outcomes: {
      "g-A1": { pick: "H", locked: true }, // locked but no odds snapshot → engine skips it
    },
    scorers: {},
    tokens: {},
    champion: { teamId: "alpha", locked: false }, // right team, but a draft — 0
  },
  // dana has no predictions entry at all.
};

const state: Euro28State = {
  version: 1,
  users: [user("admin", true), user("alice"), user("bob"), user("cara"), user("dana")],
  sessionUserId: null,
  fixtures,
  predictions,
  admin: { simNow: null },
};

// Expected values, derived from the config constants (comments show the arithmetic).
const PTS_ALICE_GA1 = Math.round(BASE_OUTCOME * OUTCOME_MULT.group * O.aliceGA1); // 10×1×1.8 = 18
const PTS_ALICE_FINAL = Math.round(BASE_OUTCOME * OUTCOME_MULT.final * O.aliceFinal); // 10×16×3.6 = 576
const PTS_ALICE_SCORER = Math.round(BASE_GOAL * SCORER_MULT.group * O.aliceScorerHot) * 2; // (10×1×2.2=22) × 2 goals = 44
const PTS_ALICE_TOKEN = Math.round(BASE_TOKEN * 2 * 2 * TOKEN_MULT.group * O.aliceTokA1); // 10×2×(+2)×1×1.7 = 68
const PTS_BOB_GB1 = Math.round(BASE_OUTCOME * OUTCOME_MULT.group * O.bobGB1); // 10×1×3.1 = 31
const PTS_BOB_TOKEN = Math.round(BASE_TOKEN * 3 * -2 * TOKEN_MULT.group * O.bobTokA1); // 10×3×(−2)×1×3.4 = −204
const PTS_ADMIN_GA1 = Math.round(BASE_OUTCOME * OUTCOME_MULT.group * O.adminGA1); // 10×1×1.8 = 18

const ALICE_TOTAL = PTS_ALICE_GA1 + PTS_ALICE_FINAL + PTS_ALICE_SCORER + PTS_ALICE_TOKEN + CHAMPION_POINTS; // 1026
const BOB_TOTAL = PTS_BOB_GB1 + PTS_BOB_TOKEN; // −173

describe("computeScores — end to end", () => {
  const results = computeScores(state, teams);
  const alice = scoreOf(results, "alice");
  const bob = scoreOf(results, "bob");
  const admin = scoreOf(results, "admin");
  const cara = scoreOf(results, "cara");
  const dana = scoreOf(results, "dana");

  it("returns one score per user, in state.users order", () => {
    expect(results.map((r) => r.userId)).toEqual(["admin", "alice", "bob", "cara", "dana"]);
  });

  it("scores alice's outcomes: correct at odds, wrong = 0, unfinished = no line", () => {
    expect(alice.outcomeLines).toHaveLength(3); // g-A3 (unfinished) produces no line
    expect(alice.outcomeLines.find((l) => l.fixtureId === "g-A3")).toBeUndefined();

    const gA1 = alice.outcomeLines.find((l) => l.fixtureId === "g-A1");
    expect(gA1).toMatchObject({ pick: "H", correct: true, odds: O.aliceGA1, points: PTS_ALICE_GA1 });

    const gB1 = alice.outcomeLines.find((l) => l.fixtureId === "g-B1");
    expect(gB1).toMatchObject({ pick: "H", correct: false, points: 0 });

    // Knockout rule: the after-extra-time draw is the payable outcome, pens are separate.
    const fin = alice.outcomeLines.find((l) => l.fixtureId === "final");
    expect(fin).toMatchObject({ pick: "D", correct: true, points: PTS_ALICE_FINAL });

    expect(alice.outcomes).toBe(PTS_ALICE_GA1 + PTS_ALICE_FINAL);
  });

  it("scores alice's scorer set: per-goal points × goals, 0-goal pick lines at 0", () => {
    expect(alice.scorerLines).toHaveLength(2);
    const hot = alice.scorerLines.find((l) => l.playerId === "p-alpha-9");
    // 2 goals in the group phase; his final goal must not leak into this set.
    expect(hot).toMatchObject({ phase: "group", goals: 2, odds: O.aliceScorerHot, points: PTS_ALICE_SCORER });
    const cold = alice.scorerLines.find((l) => l.playerId === "p-beta-7");
    expect(cold).toMatchObject({ phase: "group", goals: 0, points: 0 });
    expect(alice.scorers).toBe(PTS_ALICE_SCORER);
  });

  it("scores alice's tokens: positive netDiff pays, level match pays 0, unfinished skipped", () => {
    expect(alice.tokenLines).toHaveLength(2); // the g-A3 assign is unfinished → no line
    const winTok = alice.tokenLines.find((l) => l.fixtureId === "g-A1");
    expect(winTok).toMatchObject({ teamId: "alpha", count: 2, netDiff: 2, odds: O.aliceTokA1, points: PTS_ALICE_TOKEN });
    const levelTok = alice.tokenLines.find((l) => l.fixtureId === "g-B1");
    expect(levelTok).toMatchObject({ teamId: "delta", netDiff: 0, points: 0 });
    expect(alice.tokens).toBe(PTS_ALICE_TOKEN);
  });

  it("awards the champion flat CHAMPION_POINTS to the user who locked the pen-shootout winner", () => {
    expect(alice.championCorrect).toBe(true);
    expect(alice.champion).toBe(CHAMPION_POINTS); // flat — the 6.0 outright odds snapshot is ignored
    expect(alice.total).toBe(ALICE_TOTAL);
  });

  it("never scores unlocked picks, and token losses go negative", () => {
    // Bob's draft H on g-A1 would have been correct — but drafts don't exist to the engine.
    expect(bob.outcomeLines.find((l) => l.fixtureId === "g-A1")).toBeUndefined();
    expect(bob.outcomeLines).toHaveLength(2);
    expect(bob.outcomeLines.find((l) => l.fixtureId === "g-B1")).toMatchObject({ correct: true, points: PTS_BOB_GB1 });
    expect(bob.outcomeLines.find((l) => l.fixtureId === "final")).toMatchObject({ pick: "A", correct: false, points: 0 });

    expect(bob.scorerLines).toHaveLength(0); // draft scorer set

    expect(bob.tokenLines).toHaveLength(1);
    expect(bob.tokenLines[0]).toMatchObject({ teamId: "beta", count: 3, netDiff: -2, points: PTS_BOB_TOKEN });
    expect(PTS_BOB_TOKEN).toBeLessThan(0);

    // Champion pick on the losing finalist scores nothing.
    expect(bob.championCorrect).toBe(false);
    expect(bob.champion).toBe(0);
    expect(bob.total).toBe(BOB_TOTAL);
    expect(BOB_TOTAL).toBeLessThan(0); // net-negative totals are possible and rank last
  });

  it("gives 0 to locked-without-odds picks, draft champions, and absent users", () => {
    expect(cara.outcomeLines).toHaveLength(0); // locked but no odds snapshot → skipped
    expect(cara.champion).toBe(0); // right team, unlocked → nothing
    expect(cara.championCorrect).toBe(false);
    expect(cara.total).toBe(0);

    // dana has no predictions blob at all — still gets a (zero) score row.
    expect(dana.total).toBe(0);
    expect(dana.outcomeLines).toHaveLength(0);
    expect(dana.scorerLines).toHaveLength(0);
    expect(dana.tokenLines).toHaveLength(0);
  });

  it("ranks non-admins with shared ranks on ties and skipped ranks after", () => {
    // Totals: alice 1026 > cara 0 = dana 0 > bob −173.
    expect(alice.rank).toBe(1);
    expect(cara.rank).toBe(2);
    expect(dana.rank).toBe(2); // tied on 0 → same rank
    expect(bob.rank).toBe(4); // rank 3 is skipped after the two-way tie
  });

  it("computes the admin's points but excludes them from ranking (rank stays 0)", () => {
    // Admin's H on the final does NOT pay: alpha only won on penalties, it was a draw after extra time.
    expect(admin.outcomeLines.find((l) => l.fixtureId === "final")).toMatchObject({ correct: false, points: 0 });
    expect(admin.outcomes).toBe(PTS_ADMIN_GA1);
    expect(admin.total).toBe(PTS_ADMIN_GA1);
    expect(admin.total).toBeGreaterThan(0); // beats cara/dana/bob on points…
    expect(admin.rank).toBe(0); // …yet holds no rank
  });
});
