// Tests for group tables + best-thirds ranking. Everything is synthetic —
// 24 teams ("a1".."f4") and all 51 fixtures are generated in-test with the
// exact id scheme the engine expects; nothing is imported from data/*.

import { describe, expect, it } from "vitest";
import type { EFixture, EGroup, EPhase, ETeam } from "../types";
import { bestThirds, groupComplete, groupTable } from "./table";

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
 * with null team slots (matching lib/bracket.ts R16_TEMPLATE / KO_FEED ids).
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
 * Every win is 1-0 except t3 v t4, which t3 wins `thirdMargin[g]`–0; the
 * third-placed team therefore has GF = margin and GD = margin − 2, letting a
 * test choose which groups' thirds rank where.
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

const ids = (rows: { teamId: string }[]): string[] => rows.map((r) => r.teamId);

// ---------------------------------------------------------------------------
// groupTable
// ---------------------------------------------------------------------------

describe("groupTable", () => {
  it("returns four zeroed rows (rating order) before any results", () => {
    const rows = groupTable("A", makeFixtures(), makeTeams());
    expect(ids(rows)).toEqual(["a1", "a2", "a3", "a4"]); // all-zero tie → default ratings descend
    rows.forEach((r, i) => {
      expect(r).toMatchObject({ played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 });
      expect(r.pos).toBe(i + 1);
    });
  });

  it("orders by points and tallies P/W/D/L, GF/GA/GD", () => {
    const teams = makeTeams();
    const fx = makeFixtures();
    playAllGroups(fx, { A: 2, B: 2, C: 2, D: 2, E: 2, F: 2 });
    const rows = groupTable("A", fx, teams);
    expect(ids(rows)).toEqual(["a1", "a2", "a3", "a4"]);
    expect(rows[0]).toMatchObject({ pos: 1, played: 3, won: 3, drawn: 0, lost: 0, gf: 3, ga: 0, gd: 3, points: 9 });
    expect(rows[1]).toMatchObject({ pos: 2, played: 3, won: 2, drawn: 0, lost: 1, gf: 2, ga: 1, gd: 1, points: 6 });
    expect(rows[2]).toMatchObject({ pos: 3, played: 3, won: 1, drawn: 0, lost: 2, gf: 2, ga: 2, gd: 0, points: 3 });
    expect(rows[3]).toMatchObject({ pos: 4, played: 3, won: 0, drawn: 0, lost: 3, gf: 0, ga: 4, gd: -4, points: 0 });
  });

  it("breaks a points tie on goal difference — not head-to-head", () => {
    // a4 outrates a3 so the bottom pair's dead heat resolves on rating too.
    const teams = makeTeams({ a4: 1950 });
    const fx = makeFixtures();
    finish(fx, "g-A1", 0, 1); // a1 v a2 → a2 wins the head-to-head
    finish(fx, "g-A2", 1, 0); // a3 v a4
    finish(fx, "g-A3", 3, 0); // a1 v a3
    finish(fx, "g-A4", 0, 1); // a2 v a4
    finish(fx, "g-A5", 3, 0); // a1 v a4
    finish(fx, "g-A6", 1, 0); // a2 v a3
    const rows = groupTable("A", fx, teams);
    // a1 and a2 both have 6 pts; a1's +5 GD beats a2's +1 even though a2 beat a1.
    expect(rows[0]).toMatchObject({ teamId: "a1", points: 6, gd: 5 });
    expect(rows[1]).toMatchObject({ teamId: "a2", points: 6, gd: 1 });
    // a3 and a4 tie on points (3), GD (−3) and GF (1) → higher rating (a4) ranks 3rd.
    expect(ids(rows)).toEqual(["a1", "a2", "a4", "a3"]);
  });

  it("breaks a points + GD tie on goals for, ahead of rating", () => {
    const teams = makeTeams({ a2: 2050 }); // a2 outrates a3, but GF must decide first
    const fx = makeFixtures();
    finish(fx, "g-A1", 1, 0); // a1 v a2
    finish(fx, "g-A2", 2, 1); // a3 v a4
    finish(fx, "g-A3", 3, 2); // a1 v a3
    finish(fx, "g-A4", 1, 0); // a2 v a4
    finish(fx, "g-A5", 2, 0); // a1 v a4
    finish(fx, "g-A6", 1, 1); // a2 v a3
    const rows = groupTable("A", fx, teams);
    // a2 and a3: 4 pts and GD 0 each, but a3 scored 5 to a2's 2.
    expect(ids(rows)).toEqual(["a1", "a3", "a2", "a4"]);
    expect(rows[1]).toMatchObject({ teamId: "a3", points: 4, gd: 0, gf: 5, drawn: 1 });
    expect(rows[2]).toMatchObject({ teamId: "a2", points: 4, gd: 0, gf: 2, drawn: 1 });
  });

  it("falls through to team rating when points, GD and GF all tie", () => {
    const teams = makeTeams({ a1: 1900, a2: 1500, a3: 2050, a4: 1990 });
    const fx = makeFixtures();
    for (let i = 1; i <= 6; i++) finish(fx, `g-A${i}`, 0, 0); // six goalless draws
    const rows = groupTable("A", fx, teams);
    expect(ids(rows)).toEqual(["a3", "a4", "a1", "a2"]); // pure rating order
    for (const r of rows) expect(r).toMatchObject({ played: 3, drawn: 3, points: 3, gf: 0, gd: 0 });
  });

  it("counts only FINISHED group fixtures of the requested group", () => {
    const teams = makeTeams();
    const fx = makeFixtures();
    finish(fx, "g-B1", 5, 0); // a result in another group
    const draft = fx.find((f) => f.id === "g-A1");
    if (!draft) throw new Error("missing g-A1");
    draft.homeGoals = 4; // goals typed in but still SCHEDULED
    draft.awayGoals = 0;
    const noScore = fx.find((f) => f.id === "g-A2");
    if (!noScore) throw new Error("missing g-A2");
    noScore.status = "FINISHED"; // FINISHED but no score recorded
    const ko = fx.find((f) => f.id === "r16-1");
    if (!ko) throw new Error("missing r16-1");
    ko.homeTeamId = "a1"; // a finished knockout between two group-A teams
    ko.awayTeamId = "a2";
    finish(fx, "r16-1", 2, 0);

    const a = groupTable("A", fx, teams);
    expect(a).toHaveLength(4);
    for (const r of a) expect(r).toMatchObject({ played: 0, points: 0, gf: 0, ga: 0 });
    const b = groupTable("B", fx, teams);
    expect(b[0]).toMatchObject({ teamId: "b1", played: 1, won: 1, gf: 5, gd: 5, points: 3 });
    expect(b[2].played).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// groupComplete
// ---------------------------------------------------------------------------

describe("groupComplete", () => {
  it("is false until all six of the group's fixtures are FINISHED", () => {
    const fx = makeFixtures();
    expect(groupComplete("A", fx)).toBe(false);
    for (let i = 1; i <= 5; i++) finish(fx, `g-A${i}`, 1, 0);
    expect(groupComplete("A", fx)).toBe(false); // 5 of 6
    finish(fx, "g-A6", 0, 0);
    expect(groupComplete("A", fx)).toBe(true);
    expect(groupComplete("B", fx)).toBe(false); // other groups unaffected
  });

  it("is false when a group fixture is missing from the list entirely", () => {
    const fx = makeFixtures().filter((f) => f.id !== "g-A6");
    for (let i = 1; i <= 5; i++) finish(fx, `g-A${i}`, 1, 0);
    expect(groupComplete("A", fx)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// bestThirds
// ---------------------------------------------------------------------------

describe("bestThirds", () => {
  it("picks and ranks the four best thirds by GD when points tie", () => {
    const teams = makeTeams();
    const fx = makeFixtures();
    // Third-placed GDs: A +4, B +3, C +2, D +1, E −1, F −1 (all on 3 pts).
    playAllGroups(fx, { A: 6, B: 5, C: 4, D: 3, E: 1, F: 1 });
    expect(bestThirds(fx, teams)).toEqual([
      { group: "A", teamId: "a3" },
      { group: "B", teamId: "b3" },
      { group: "C", teamId: "c3" },
      { group: "D", teamId: "d3" },
    ]);
  });

  it("ranks a third with more points above better-GD thirds", () => {
    const teams = makeTeams();
    const fx = makeFixtures();
    playAllGroups(fx, { A: 2, B: 5, C: 4, D: 1, E: 1, F: 1 });
    // Rewrite group E so its third finishes on 4 points (W + D + L, GD −1).
    finish(fx, "g-E1", 1, 0); // e1 v e2
    finish(fx, "g-E2", 1, 0); // e3 v e4
    finish(fx, "g-E3", 2, 0); // e1 v e3
    finish(fx, "g-E4", 3, 0); // e2 v e4
    finish(fx, "g-E5", 1, 0); // e1 v e4
    finish(fx, "g-E6", 1, 1); // e2 v e3 — e2 (GD +2) stays 2nd, e3 (GD −1) 3rd
    const thirds = bestThirds(fx, teams);
    expect(thirds).toEqual([
      { group: "E", teamId: "e3" }, // 4 pts beats every 3-pt third despite GD −1
      { group: "B", teamId: "b3" }, // then 3-pt thirds by GD: +3, +2, 0
      { group: "C", teamId: "c3" },
      { group: "A", teamId: "a3" },
    ]);
  });

  it("ranks thirds tied on points and GD by goals for", () => {
    const teams = makeTeams();
    const fx = makeFixtures();
    playAllGroups(fx, { A: 6, B: 5, C: 3, D: 3, E: 1, F: 1 });
    // c3's two losses become 1-2 instead of 0-1: GD stays +1 (= d3) but GF 5 v 3.
    finish(fx, "g-C3", 2, 1); // c1 v c3
    finish(fx, "g-C6", 2, 1); // c2 v c3
    expect(bestThirds(fx, teams)).toEqual([
      { group: "A", teamId: "a3" },
      { group: "B", teamId: "b3" },
      { group: "C", teamId: "c3" }, // GF 5
      { group: "D", teamId: "d3" }, // GF 3
    ]);
  });

  it("resolves a dead heat for the last spot by team rating", () => {
    // d3, e3, f3 all finish 3 pts / GD −1 / GF 1 — f3's rating wins the spot.
    const teams = makeTeams({ f3: 1995 });
    const fx = makeFixtures();
    playAllGroups(fx, { A: 6, B: 5, C: 4, D: 1, E: 1, F: 1 });
    expect(bestThirds(fx, teams)).toEqual([
      { group: "A", teamId: "a3" },
      { group: "B", teamId: "b3" },
      { group: "C", teamId: "c3" },
      { group: "F", teamId: "f3" },
    ]);
  });
});
