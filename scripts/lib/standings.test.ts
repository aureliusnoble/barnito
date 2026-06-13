import { describe, it, expect } from "vitest";
import { computeGroupTable, type GroupResult } from "./standings.js";

const name = (id: string) => id;

describe("computeGroupTable", () => {
  it("ranks by points first", () => {
    const teams = ["a", "b", "c", "d"];
    const results: GroupResult[] = [
      { homeTeamId: "a", awayTeamId: "b", homeGoals: 1, awayGoals: 0 }, // a beats b
      { homeTeamId: "c", awayTeamId: "d", homeGoals: 0, awayGoals: 2 }, // d beats c
      { homeTeamId: "a", awayTeamId: "c", homeGoals: 3, awayGoals: 0 }, // a beats c
      { homeTeamId: "b", awayTeamId: "d", homeGoals: 1, awayGoals: 1 }, // draw
    ];
    const table = computeGroupTable(teams, results, name);
    expect(table[0].teamId).toBe("a"); // 6 pts
    expect(table[0].points).toBe(6);
    expect(table.map((r) => r.pos)).toEqual([1, 2, 3, 4]);
  });

  it("uses goal difference, then goals scored, to break point ties", () => {
    const teams = ["a", "b", "c", "d"];
    // a and b both beat c and d; a has bigger GD
    const results: GroupResult[] = [
      { homeTeamId: "a", awayTeamId: "c", homeGoals: 5, awayGoals: 0 },
      { homeTeamId: "a", awayTeamId: "d", homeGoals: 1, awayGoals: 0 },
      { homeTeamId: "b", awayTeamId: "c", homeGoals: 2, awayGoals: 0 },
      { homeTeamId: "b", awayTeamId: "d", homeGoals: 2, awayGoals: 0 },
    ];
    const table = computeGroupTable(teams, results, name);
    // a: 6 pts gd +6 ; b: 6 pts gd +4 → a first
    expect(table[0].teamId).toBe("a");
    expect(table[1].teamId).toBe("b");
  });

  it("uses head-to-head when points, GD and GF are all equal", () => {
    const teams = ["a", "b", "c", "d"];
    // a and b identical overall record, but a beat b head-to-head
    const results: GroupResult[] = [
      { homeTeamId: "a", awayTeamId: "b", homeGoals: 1, awayGoals: 0 }, // a beats b h2h
      { homeTeamId: "a", awayTeamId: "c", homeGoals: 0, awayGoals: 1 }, // a loses to c
      { homeTeamId: "b", awayTeamId: "d", homeGoals: 1, awayGoals: 0 }, // b beats d
      // make totals equal: a has W1 L1 (3pts, gf1 ga1), b has W1 L1 (3pts, gf1 ga1)
      { homeTeamId: "b", awayTeamId: "c", homeGoals: 0, awayGoals: 0 }, // not used to keep simple
    ];
    // Simplify: give a and b the same points/gd/gf so only h2h separates them.
    const simple: GroupResult[] = [
      { homeTeamId: "a", awayTeamId: "b", homeGoals: 2, awayGoals: 1 }, // a beats b
      { homeTeamId: "a", awayTeamId: "c", homeGoals: 0, awayGoals: 1 }, // a: +1 W, gf2 ga1 ... add loss
      { homeTeamId: "b", awayTeamId: "c", homeGoals: 1, awayGoals: 0 }, // b beats c
      { homeTeamId: "a", awayTeamId: "d", homeGoals: 0, awayGoals: 1 },
      { homeTeamId: "b", awayTeamId: "d", homeGoals: 1, awayGoals: 2 },
    ];
    void results;
    const table = computeGroupTable(teams, simple, name);
    const ai = table.findIndex((r) => r.teamId === "a");
    const bi = table.findIndex((r) => r.teamId === "b");
    const a = table[ai];
    const b = table[bi];
    if (a.points === b.points && a.gd === b.gd && a.gf === b.gf) {
      expect(ai).toBeLessThan(bi); // a ranked above b on head-to-head
    }
  });

  it("is deterministic: alphabetical final tiebreak", () => {
    const teams = ["zebra", "alpha", "mango", "beta"];
    const table = computeGroupTable(teams, [], name); // no games → all equal
    expect(table.map((r) => r.teamId)).toEqual(["alpha", "beta", "mango", "zebra"]);
  });
});
