// Tests for knockout bracket wiring: winnerOf, advanceBracket (R16 from group
// finishes incl. the UEFA thirds mapping, later rounds from KO_FEED) and
// championOf. Everything is synthetic — 24 teams ("a1".."f4") and all 51
// fixtures are generated in-test; nothing is imported from data/*.

import { describe, expect, it } from "vitest";
import type { EFixture, EGroup, EPhase, ETeam } from "../types";
import { KO_FEED, R16_TEMPLATE, advanceBracket, championOf, groupsComplete, winnerOf } from "./bracket";
import { bestThirds } from "./table";

// ---------------------------------------------------------------------------
// Synthetic tournament builders (no imports from data/*).
// ---------------------------------------------------------------------------

const GROUPS: EGroup[] = ["A", "B", "C", "D", "E", "F"];

/** Round-robin pairings (team slots 1–4) in fixture order g-X1..g-X6. */
const PAIRINGS: [number, number][] = [
  [1, 2],
  [3, 4],
  [1, 3],
  [2, 4],
  [1, 4],
  [2, 3],
];

function teamId(group: EGroup, slot: number): string {
  return `${group.toLowerCase()}${slot}`;
}

/** 24 teams; default ratings descend a1 > a2 > a3 > a4 within each group. */
function makeTeams(ratingOverrides: Record<string, number> = {}): ETeam[] {
  const teams: ETeam[] = [];
  GROUPS.forEach((g, gi) => {
    for (let slot = 1; slot <= 4; slot++) {
      const id = teamId(g, slot);
      teams.push({
        id,
        name: `Team ${g}${slot}`,
        code: `${g}${slot}T`,
        group: g,
        rating: ratingOverrides[id] ?? 2000 - gi * 10 - (slot - 1) * 100,
        color: "#8bff00",
        flag: "🏳️",
      });
    }
  });
  return teams;
}

/**
 * All 51 fixtures, SCHEDULED: 36 group games ("g-A1".."g-F6" per PAIRINGS)
 * plus knockouts "r16-1".."r16-8", "qf-1".."qf-4", "sf-1", "sf-2", "final"
 * with null team slots — the exact ids R16_TEMPLATE / KO_FEED expect.
 */
function makeFixtures(): EFixture[] {
  let hour = 0;
  const fixture = (id: string, phase: EPhase, extra: Partial<EFixture> = {}): EFixture => ({
    id,
    phase,
    kickoff: new Date(Date.UTC(2028, 5, 9, 12) + hour++ * 36e5).toISOString(),
    venue: "Test Ground",
    city: "Testville",
    homeTeamId: null,
    awayTeamId: null,
    status: "SCHEDULED",
    homeGoals: null,
    awayGoals: null,
    scorers: [],
    ...extra,
  });
  const fx: EFixture[] = [];
  for (const g of GROUPS) {
    PAIRINGS.forEach(([h, a], i) => {
      fx.push(
        fixture(`g-${g}${i + 1}`, "group", {
          group: g,
          homeTeamId: teamId(g, h),
          awayTeamId: teamId(g, a),
        }),
      );
    });
  }
  for (let i = 1; i <= 8; i++) fx.push(fixture(`r16-${i}`, "r16", { homeLabel: `R16 home ${i}`, awayLabel: `R16 away ${i}` }));
  for (let i = 1; i <= 4; i++) fx.push(fixture(`qf-${i}`, "qf", { homeLabel: `QF home ${i}`, awayLabel: `QF away ${i}` }));
  fx.push(fixture("sf-1", "sf", { homeLabel: "SF1 home", awayLabel: "SF1 away" }));
  fx.push(fixture("sf-2", "sf", { homeLabel: "SF2 home", awayLabel: "SF2 away" }));
  fx.push(fixture("final", "final", { homeLabel: "Final home", awayLabel: "Final away" }));
  return fx;
}

/** Record a result on the fixture with this id (mutates the test array). */
function finish(fixtures: EFixture[], id: string, homeGoals: number, awayGoals: number, penWinnerTeamId?: string): void {
  const f = fixtures.find((x) => x.id === id);
  if (!f) throw new Error(`missing fixture ${id}`);
  f.status = "FINISHED";
  f.homeGoals = homeGoals;
  f.awayGoals = awayGoals;
  if (penWinnerTeamId !== undefined) f.penWinnerTeamId = penWinnerTeamId;
}

/**
 * Finish every group with a strict hierarchy — t1 beats t2/t3/t4, t2 beats
 * t3/t4, t3 beats t4 — so each table reads t1 (9 pts), t2 (6), t3 (3), t4 (0).
 * Every win is 1-0 except t3 v t4, which t3 wins `thirdMargin[g]`–0; a group's
 * third therefore has GD = margin − 2, which controls WHICH thirds qualify.
 */
function playAllGroups(fixtures: EFixture[], thirdMargin: Record<EGroup, number>): void {
  for (const g of GROUPS) {
    finish(fixtures, `g-${g}1`, 1, 0); // t1 v t2
    finish(fixtures, `g-${g}2`, thirdMargin[g], 0); // t3 v t4
    finish(fixtures, `g-${g}3`, 1, 0); // t1 v t3
    finish(fixtures, `g-${g}4`, 1, 0); // t2 v t4
    finish(fixtures, `g-${g}5`, 1, 0); // t1 v t4
    finish(fixtures, `g-${g}6`, 1, 0); // t2 v t3
  }
}

function pair(fixtures: EFixture[], id: string): [string | null, string | null] {
  const f = fixtures.find((x) => x.id === id);
  if (!f) throw new Error(`missing fixture ${id}`);
  return [f.homeTeamId, f.awayTeamId];
}

const KO_IDS = [
  ...Array.from({ length: 8 }, (_, i) => `r16-${i + 1}`),
  ...Array.from({ length: 4 }, (_, i) => `qf-${i + 1}`),
  "sf-1",
  "sf-2",
  "final",
];

/** A standalone knockout fixture for winnerOf. */
function knockoutFixture(overrides: Partial<EFixture> = {}): EFixture {
  return {
    id: "r16-1",
    phase: "r16",
    kickoff: "2028-06-25T18:00:00.000Z",
    venue: "Test Ground",
    city: "Testville",
    homeTeamId: "a1",
    awayTeamId: "b2",
    status: "FINISHED",
    homeGoals: null,
    awayGoals: null,
    scorers: [],
    ...overrides,
  };
}

/**
 * Hand-copied mirror of THIRDS_TABLE in ./bracket.ts (not exported): for each
 * sorted qualified-thirds combo, which group's third meets each of the four
 * hosting group winners 1B / 1C / 1E / 1F. A mismatch fails the sweep test.
 */
const THIRDS_ROWS: Record<string, { B: EGroup; C: EGroup; E: EGroup; F: EGroup }> = {
  ABCD: { B: "A", C: "D", E: "B", F: "C" },
  ABCE: { B: "A", C: "E", E: "B", F: "C" },
  ABCF: { B: "A", C: "F", E: "B", F: "C" },
  ABDE: { B: "D", C: "E", E: "A", F: "B" },
  ABDF: { B: "D", C: "F", E: "A", F: "B" },
  ABEF: { B: "E", C: "F", E: "A", F: "B" },
  ACDE: { B: "E", C: "D", E: "C", F: "A" },
  ACDF: { B: "F", C: "D", E: "C", F: "A" },
  ACEF: { B: "E", C: "F", E: "C", F: "A" },
  ADEF: { B: "E", C: "F", E: "D", F: "A" },
  BCDE: { B: "E", C: "D", E: "B", F: "C" },
  BCDF: { B: "F", C: "D", E: "C", F: "B" },
  BCEF: { B: "F", C: "E", E: "C", F: "B" },
  BDEF: { B: "F", C: "E", E: "D", F: "B" },
  CDEF: { B: "F", C: "E", E: "D", F: "C" },
};

/** Which R16 fixture each hosting group winner (1B/1C/1E/1F) plays a third in. */
const HOST_FIXTURE: Record<"B" | "C" | "E" | "F", string> = {
  B: "r16-4",
  C: "r16-3",
  E: "r16-7",
  F: "r16-6",
};

// ---------------------------------------------------------------------------
// winnerOf
// ---------------------------------------------------------------------------

describe("winnerOf", () => {
  it("is null before the fixture is FINISHED", () => {
    expect(winnerOf(knockoutFixture({ status: "SCHEDULED", homeGoals: 2, awayGoals: 0 }))).toBeNull();
  });

  it("is null when a FINISHED fixture is missing a score", () => {
    expect(winnerOf(knockoutFixture())).toBeNull();
    expect(winnerOf(knockoutFixture({ homeGoals: 1 }))).toBeNull();
    expect(winnerOf(knockoutFixture({ awayGoals: 1 }))).toBeNull();
  });

  it("returns the 90-minute winner", () => {
    expect(winnerOf(knockoutFixture({ homeGoals: 2, awayGoals: 1 }))).toBe("a1");
    expect(winnerOf(knockoutFixture({ homeGoals: 0, awayGoals: 3 }))).toBe("b2");
  });

  it("returns the shootout winner for a draw, and null when no shootout is recorded", () => {
    expect(winnerOf(knockoutFixture({ homeGoals: 1, awayGoals: 1 }))).toBeNull();
    expect(winnerOf(knockoutFixture({ homeGoals: 1, awayGoals: 1, penWinnerTeamId: null }))).toBeNull();
    expect(winnerOf(knockoutFixture({ homeGoals: 1, awayGoals: 1, penWinnerTeamId: "a1" }))).toBe("a1");
    expect(winnerOf(knockoutFixture({ homeGoals: 0, awayGoals: 0, penWinnerTeamId: "b2" }))).toBe("b2");
  });

  it("prefers the 90-minute scoreline over a stray shootout entry", () => {
    expect(winnerOf(knockoutFixture({ homeGoals: 3, awayGoals: 1, penWinnerTeamId: "b2" }))).toBe("a1");
  });
});

// ---------------------------------------------------------------------------
// groupsComplete
// ---------------------------------------------------------------------------

describe("groupsComplete", () => {
  it("requires all six groups to be fully FINISHED", () => {
    const fx = makeFixtures();
    expect(groupsComplete(fx)).toBe(false);
    playAllGroups(fx, { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1 });
    expect(groupsComplete(fx)).toBe(true);
    const f6 = fx.find((f) => f.id === "g-F6");
    if (!f6) throw new Error("missing g-F6");
    f6.status = "SCHEDULED"; // one game short again
    expect(groupsComplete(fx)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// advanceBracket
// ---------------------------------------------------------------------------

describe("advanceBracket", () => {
  it("R16_TEMPLATE and KO_FEED reference exactly the synthetic knockout ids", () => {
    const fxIds = new Set(makeFixtures().map((f) => f.id));
    expect(Object.keys(R16_TEMPLATE).sort()).toEqual(
      Array.from({ length: 8 }, (_, i) => `r16-${i + 1}`).sort(),
    );
    expect(Object.keys(KO_FEED).sort()).toEqual(["final", "qf-1", "qf-2", "qf-3", "qf-4", "sf-1", "sf-2"]);
    for (const [id, feeds] of Object.entries(KO_FEED)) {
      expect(fxIds.has(id)).toBe(true);
      for (const feed of feeds) expect(fxIds.has(feed)).toBe(true);
    }
  });

  it("fills nothing while any group is unfinished", () => {
    const teams = makeTeams();
    const fx = makeFixtures();
    // Untouched tournament: nothing to fill.
    for (const id of KO_IDS) expect(pair(advanceBracket(fx, teams), id)).toEqual([null, null]);
    // 35 of 36 group games done — group F one short.
    playAllGroups(fx, { A: 2, B: 2, C: 2, D: 2, E: 2, F: 2 });
    const f6 = fx.find((f) => f.id === "g-F6");
    if (!f6) throw new Error("missing g-F6");
    f6.status = "SCHEDULED";
    f6.homeGoals = null;
    f6.awayGoals = null;
    const out = advanceBracket(fx, teams);
    for (const id of KO_IDS) expect(pair(out, id)).toEqual([null, null]);
  });

  it("returns copies — the input fixtures are not mutated", () => {
    const teams = makeTeams();
    const fx = makeFixtures();
    playAllGroups(fx, { A: 6, B: 5, C: 4, D: 3, E: 1, F: 1 });
    const out = advanceBracket(fx, teams);
    expect(pair(out, "r16-1")).toEqual(["a2", "b2"]);
    expect(pair(fx, "r16-1")).toEqual([null, null]); // input untouched
  });

  it("fills every R16 slot per R16_TEMPLATE (thirds combo ABCD)", () => {
    const teams = makeTeams();
    const fx = makeFixtures();
    // Third-place GDs: A +4, B +3, C +2, D +1, E −1, F −1 → thirds from A,B,C,D.
    playAllGroups(fx, { A: 6, B: 5, C: 4, D: 3, E: 1, F: 1 });
    expect(bestThirds(fx, teams).map((t) => t.group).sort().join("")).toBe("ABCD");
    const out = advanceBracket(fx, teams);
    // Winners and runners-up land per the template…
    expect(pair(out, "r16-1")).toEqual(["a2", "b2"]); // 2A v 2B
    expect(pair(out, "r16-2")).toEqual(["a1", "c2"]); // 1A v 2C
    expect(pair(out, "r16-5")).toEqual(["d2", "e2"]); // 2D v 2E
    expect(pair(out, "r16-8")).toEqual(["d1", "f2"]); // 1D v 2F
    // …and each hosting winner meets the third THIRDS_TABLE.ABCD dictates:
    // { B: "A", C: "D", E: "B", F: "C" }.
    expect(pair(out, "r16-4")).toEqual(["b1", "a3"]); // 1B v 3A
    expect(pair(out, "r16-3")).toEqual(["c1", "d3"]); // 1C v 3D
    expect(pair(out, "r16-7")).toEqual(["e1", "b3"]); // 1E v 3B
    expect(pair(out, "r16-6")).toEqual(["f1", "c3"]); // 1F v 3C
    // No knockout results yet → QF/SF/final stay empty.
    for (const id of ["qf-1", "qf-2", "qf-3", "qf-4", "sf-1", "sf-2", "final"]) {
      expect(pair(out, id)).toEqual([null, null]);
    }
    // Advancing again changes nothing.
    const again = advanceBracket(out, teams);
    for (const id of KO_IDS) expect(pair(again, id)).toEqual(pair(out, id));
  });

  it("assigns thirds per THIRDS_TABLE for combo CDEF", () => {
    const teams = makeTeams();
    const fx = makeFixtures();
    playAllGroups(fx, { A: 1, B: 1, C: 6, D: 5, E: 4, F: 3 });
    expect(bestThirds(fx, teams).map((t) => t.group).sort().join("")).toBe("CDEF");
    const out = advanceBracket(fx, teams);
    // THIRDS_TABLE.CDEF = { B: "F", C: "E", E: "D", F: "C" }.
    expect(pair(out, "r16-4")).toEqual(["b1", "f3"]); // 1B v 3F
    expect(pair(out, "r16-3")).toEqual(["c1", "e3"]); // 1C v 3E
    expect(pair(out, "r16-7")).toEqual(["e1", "d3"]); // 1E v 3D
    expect(pair(out, "r16-6")).toEqual(["f1", "c3"]); // 1F v 3C
    // Pos-based slots are combo-independent.
    expect(pair(out, "r16-1")).toEqual(["a2", "b2"]);
    expect(pair(out, "r16-2")).toEqual(["a1", "c2"]);
    expect(pair(out, "r16-5")).toEqual(["d2", "e2"]);
    expect(pair(out, "r16-8")).toEqual(["d1", "f2"]);
  });

  it("matches the UEFA mapping row for every one of the 15 thirds combos", () => {
    const combos: EGroup[][] = [];
    for (let i = 0; i < GROUPS.length; i++)
      for (let j = i + 1; j < GROUPS.length; j++)
        for (let k = j + 1; k < GROUPS.length; k++)
          for (let l = k + 1; l < GROUPS.length; l++) combos.push([GROUPS[i], GROUPS[j], GROUPS[k], GROUPS[l]]);
    expect(combos).toHaveLength(15);
    for (const combo of combos) {
      const key = combo.join(""); // already alphabetical
      const row = THIRDS_ROWS[key];
      expect(row).toBeDefined();
      const teams = makeTeams();
      const fx = makeFixtures();
      const margins: Record<EGroup, number> = { A: 1, B: 1, C: 1, D: 1, E: 1, F: 1 };
      combo.forEach((g, n) => (margins[g] = 6 - n)); // qualified thirds get GD +4..+1
      playAllGroups(fx, margins);
      expect(bestThirds(fx, teams).map((t) => t.group).sort().join(""), `combo ${key}`).toBe(key);
      const out = advanceBracket(fx, teams);
      for (const host of ["B", "C", "E", "F"] as const) {
        const [home, away] = pair(out, HOST_FIXTURE[host]);
        expect(home, `1${host} hosts ${HOST_FIXTURE[host]}`).toBe(teamId(host, 1));
        expect(away, `combo ${key}: 1${host}'s opponent`).toBe(teamId(row[host], 3));
      }
    }
  });

  it("feeds winners through QF, SF and the final per KO_FEED — including shootout winners", () => {
    const teams = makeTeams();
    let fx = makeFixtures();
    playAllGroups(fx, { A: 6, B: 5, C: 4, D: 3, E: 1, F: 1 }); // combo ABCD
    fx = advanceBracket(fx, teams);

    // A single R16 result fills only its half of the QF pairing.
    finish(fx, "r16-3", 1, 0); // c1 beats d3
    fx = advanceBracket(fx, teams);
    expect(pair(fx, "qf-1")).toEqual(["c1", null]); // r16-1 still unplayed

    finish(fx, "r16-1", 2, 0); // a2
    finish(fx, "r16-2", 3, 1); // a1
    finish(fx, "r16-4", 0, 1); // a3 — away win
    finish(fx, "r16-5", 1, 1, "e2"); // e2 on penalties
    finish(fx, "r16-6", 2, 1); // f1
    finish(fx, "r16-7", 0, 0, "e1"); // e1 on penalties
    finish(fx, "r16-8", 1, 2); // f2 — away win
    fx = advanceBracket(fx, teams);
    expect(pair(fx, "qf-1")).toEqual(["c1", "a2"]); // ← r16-3, r16-1
    expect(pair(fx, "qf-2")).toEqual(["e2", "f1"]); // ← r16-5 (pens), r16-6
    expect(pair(fx, "qf-3")).toEqual(["e1", "f2"]); // ← r16-7 (pens), r16-8
    expect(pair(fx, "qf-4")).toEqual(["a1", "a3"]); // ← r16-2, r16-4
    expect(pair(fx, "sf-1")).toEqual([null, null]);
    expect(pair(fx, "sf-2")).toEqual([null, null]);
    expect(championOf(fx)).toBeNull();

    finish(fx, "qf-1", 2, 1); // c1
    finish(fx, "qf-2", 0, 1); // f1
    finish(fx, "qf-3", 2, 2, "f2"); // f2 on penalties
    finish(fx, "qf-4", 4, 0); // a1
    fx = advanceBracket(fx, teams);
    expect(pair(fx, "sf-1")).toEqual(["f1", "a1"]); // ← qf-2, qf-4
    expect(pair(fx, "sf-2")).toEqual(["c1", "f2"]); // ← qf-1 (incl. pens feeder), qf-3
    expect(pair(fx, "final")).toEqual([null, null]);

    finish(fx, "sf-1", 0, 2); // a1
    finish(fx, "sf-2", 1, 0); // c1
    fx = advanceBracket(fx, teams);
    expect(pair(fx, "final")).toEqual(["a1", "c1"]); // ← sf-1, sf-2
    expect(championOf(fx)).toBeNull(); // final still SCHEDULED

    finish(fx, "final", 2, 2); // drawn final, shootout not recorded yet
    expect(championOf(fx)).toBeNull();
    const final = fx.find((f) => f.id === "final");
    if (!final) throw new Error("missing final");
    final.penWinnerTeamId = "c1";
    expect(championOf(fx)).toBe("c1"); // champion decided on penalties
  });
});

// ---------------------------------------------------------------------------
// championOf
// ---------------------------------------------------------------------------

describe("championOf", () => {
  it("is null with no final fixture and while the final is unresolved", () => {
    expect(championOf([])).toBeNull();
    expect(championOf(makeFixtures())).toBeNull();
  });

  it("returns the final's 90-minute winner once FINISHED", () => {
    const fx = makeFixtures();
    const final = fx.find((f) => f.id === "final");
    if (!final) throw new Error("missing final");
    final.homeTeamId = "a1";
    final.awayTeamId = "b1";
    finish(fx, "final", 3, 1);
    expect(championOf(fx)).toBe("a1");
  });
});
