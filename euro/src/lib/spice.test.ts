import { describe, expect, it } from "vitest";
import type { Euro28State, ETeam, EFixture } from "../types";
import { fixtureSpice, spiceLevel } from "./spice";
import { marginSpread } from "./odds";

const team = (id: string, rating: number): ETeam => ({ id, name: id, code: id.toUpperCase().slice(0, 3), group: "A", rating, color: "#fff", flag: "🏳️" });
const HOME = team("alpha", 1950);
const AWAY = team("beta", 1700);
const teamById = new Map([[HOME.id, HOME], [AWAY.id, AWAY]]);

const fixture: EFixture = {
  id: "g-A1", phase: "group", group: "A", kickoff: "2028-06-09T13:00:00Z", venue: "V", city: "C",
  homeTeamId: "alpha", awayTeamId: "beta", status: "SCHEDULED", homeGoals: null, awayGoals: null, scorers: [],
};

function state(withPicks: boolean): Euro28State {
  const users = [
    { id: "a", name: "A", isAdmin: false, emoji: "🅰️" },
    { id: "b", name: "B", isAdmin: false, emoji: "🅱️" },
    { id: "adm", name: "Admin", isAdmin: true, emoji: "🛠️" },
  ];
  const spread = marginSpread(fixture, HOME, AWAY, "alpha", Date.parse(fixture.kickoff));
  return {
    version: 2, users, sessionUserId: null, fixtures: [fixture], admin: { simNow: null },
    predictions: {
      a: {
        outcomes: withPicks ? { "g-A1": { pick: "H", locked: true, odds: 1.5, prob: 0.66 } } : {},
        scorers: {}, champion: null,
        tokens: withPicks ? { group: { assigns: [{ fixtureId: "g-A1", teamId: "alpha", count: 3 }], locked: true, spreadByAssign: { "g-A1:alpha": spread } } } : {},
      },
      b: {
        outcomes: withPicks ? { "g-A1": { pick: "A", locked: true, odds: 6.0, prob: 0.16 } } : {},
        scorers: {}, tokens: {}, champion: null,
      },
      adm: { outcomes: {}, scorers: {}, tokens: {}, champion: null },
    },
  };
}

describe("fixtureSpice", () => {
  it("is zero with no locked picks, positive once players disagree", () => {
    expect(fixtureSpice(state(false), teamById, fixture)).toBe(0);
    const spice = fixtureSpice(state(true), teamById, fixture);
    expect(spice).toBeGreaterThan(0.2);
  });

  it("is zero for fixtures without teams", () => {
    const tbd = { ...fixture, id: "r16-1", homeTeamId: null, awayTeamId: null };
    expect(fixtureSpice(state(true), teamById, tbd)).toBe(0);
  });

  it("maps to chili levels monotonically", () => {
    expect(spiceLevel(0)).toBe(0);
    expect(spiceLevel(0.3)).toBe(1);
    expect(spiceLevel(0.7)).toBe(2);
    expect(spiceLevel(2)).toBe(3);
    expect(spiceLevel(0.3)).toBeLessThanOrEqual(spiceLevel(0.7));
  });
});
