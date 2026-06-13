import { describe, it, expect } from "vitest";
import { matchPoints, computeScores, type ScoringInput } from "./scoring.js";
import type {
  Roster,
  MatchesFile,
  PredictionsFile,
  StandingsFile,
} from "@shared/types.js";

describe("matchPoints", () => {
  it("awards 45 for an exact scoreline (15 + 30)", () => {
    expect(matchPoints(2, 1, 2, 1)).toEqual({ points: 45, exact: true, outcome: true });
  });
  it("awards 45 for an exact draw", () => {
    expect(matchPoints(1, 1, 1, 1)).toEqual({ points: 45, exact: true, outcome: true });
  });
  it("awards 30 for correct outcome but wrong score", () => {
    expect(matchPoints(2, 0, 3, 1)).toEqual({ points: 30, exact: false, outcome: true });
  });
  it("awards 0 for wrong outcome", () => {
    expect(matchPoints(2, 1, 0, 1)).toEqual({ points: 0, exact: false, outcome: false });
  });
  it("predicted draw but actual win scores 0", () => {
    expect(matchPoints(1, 1, 2, 1)).toEqual({ points: 0, exact: false, outcome: false });
  });
});

// --- end-to-end mini tournament -------------------------------------------

function makeInput(): ScoringInput {
  const roster: Roster = {
    updatedAt: "x",
    teams: [
      { id: "a", name: "Aland", group: "A", apiId: null },
      { id: "b", name: "Bland", group: "A", apiId: null },
      { id: "c", name: "Cland", group: "A", apiId: null },
      { id: "d", name: "Dland", group: "A", apiId: null },
    ],
    players: [
      { id: "p_def", apiId: 1, name: "Deffy", teamId: "a", position: "DEF", goalMultiplier: 32 },
      { id: "p_mid", apiId: 2, name: "Middy", teamId: "a", position: "MID", goalMultiplier: 16 },
      { id: "p_fwd", apiId: 3, name: "Fwdy", teamId: "b", position: "FWD", goalMultiplier: 8 },
    ],
  };

  const matches: MatchesFile = {
    updatedAt: "x",
    tournamentComplete: false,
    championTeamId: null,
    matches: [
      {
        id: "A-1", apiId: null, group: "A", matchday: 1, kickoff: "2026-06-11T18:00:00Z",
        homeTeamId: "a", awayTeamId: "b", status: "FINISHED", elapsed: 90,
        homeGoals: 2, awayGoals: 1,
        goals: [
          { playerId: "p_def", apiPlayerId: 1, playerName: "Deffy", minute: 10, teamId: "a", ownGoal: false },
          { playerId: "p_mid", apiPlayerId: 2, playerName: "Middy", minute: 20, teamId: "a", ownGoal: false },
          { playerId: "p_fwd", apiPlayerId: 3, playerName: "Fwdy", minute: 80, teamId: "b", ownGoal: false },
        ],
      },
      {
        id: "A-2", apiId: null, group: "A", matchday: 1, kickoff: "2026-06-12T18:00:00Z",
        homeTeamId: "c", awayTeamId: "d", status: "SCHEDULED", elapsed: null,
        homeGoals: null, awayGoals: null, goals: [],
      },
    ],
  };

  const predictions: PredictionsFile = {
    updatedAt: "x",
    participants: [
      {
        id: "alice", name: "Alice",
        matchScores: [
          { matchId: "A-1", home: 2, away: 1 }, // exact → 45
          { matchId: "A-2", home: 1, away: 0 },
        ],
        topPlayers: ["p_def", "p_fwd"], // def scored 1 → 32, fwd scored 1 → 8 = 40
        champion: "a",
      },
      {
        id: "bob", name: "Bob",
        matchScores: [
          { matchId: "A-1", home: 3, away: 0 }, // outcome only → 30
          { matchId: "A-2", home: 0, away: 2 },
        ],
        topPlayers: ["p_mid"], // mid scored 1 → 16
        champion: "b",
      },
    ],
  };

  const standings: StandingsFile = {
    updatedAt: "x",
    groups: [{ group: "A", final: false, rows: [] }],
  };

  return { roster, matches, predictions, standings };
}

describe("computeScores", () => {
  const out = computeScores(makeInput());

  it("computes per-match points for finished matches", () => {
    const m = out.perMatch.find((p) => p.matchId === "A-1")!;
    const alice = m.predictions.find((p) => p.participantId === "alice")!;
    const bob = m.predictions.find((p) => p.participantId === "bob")!;
    expect(alice.points).toBe(45);
    expect(alice.exact).toBe(true);
    expect(alice.live).toBe(false);
    expect(bob.points).toBe(30);
    expect(bob.exact).toBe(false);
  });

  it("scheduled matches carry predictions but no points", () => {
    const m = out.perMatch.find((p) => p.matchId === "A-2")!;
    const alice = m.predictions.find((p) => p.participantId === "alice")!;
    expect(alice.predHome).toBe(1);
    expect(alice.points).toBe(0);
  });

  it("computes scorer points by position multiplier, excluding own goals", () => {
    const alice = out.scorerView.find((s) => s.participantId === "alice")!;
    expect(alice.total).toBe(32 + 8); // def 32 + fwd 8
    const bob = out.scorerView.find((s) => s.participantId === "bob")!;
    expect(bob.total).toBe(16); // mid 16
  });

  it("does not award standings points until the group is final", () => {
    const alice = out.predictedStandings.find((s) => s.participantId === "alice")!;
    const grpA = alice.groups.find((g) => g.group === "A")!;
    expect(grpA.counted).toBe(false);
    expect(grpA.points).toBe(0);
  });

  it("ranks the leaderboard and stacks the totals", () => {
    const alice = out.leaderboard.find((l) => l.participantId === "alice")!;
    // 45 (match) + 40 (scorers) = 85
    expect(alice.total).toBe(85);
    expect(alice.breakdown.exactScores).toBe(15);
    expect(alice.breakdown.outcomes).toBe(30);
    expect(alice.breakdown.scorers).toBe(40);
    expect(out.leaderboard[0].participantId).toBe("alice");
    expect(out.leaderboard[0].rank).toBe(1);
  });

  it("withholds champion points until the tournament completes", () => {
    const alice = out.leaderboard.find((l) => l.participantId === "alice")!;
    expect(alice.breakdown.champion).toBe(0);
  });

  it("excludes finished matches from spiciness, keeps scheduled ones", () => {
    expect(out.spiciness.some((s) => s.matchId === "A-1")).toBe(false);
    expect(out.spiciness.some((s) => s.matchId === "A-2")).toBe(true);
  });
});

describe("computeScores — live matches award no points", () => {
  const input = makeInput();
  const a2 = input.matches.matches.find((m) => m.id === "A-2")!;
  a2.status = "LIVE";
  a2.elapsed = 60;
  a2.homeGoals = 1;
  a2.awayGoals = 0;
  const out = computeScores(input);

  it("awards 0 points live but flags the matching prediction", () => {
    const m = out.perMatch.find((p) => p.matchId === "A-2")!;
    const alice = m.predictions.find((p) => p.participantId === "alice")!; // predicted 1-0
    expect(alice.points).toBe(0);
    expect(alice.live).toBe(true);
    expect(alice.matchesCurrentScore).toBe(true);
    expect(alice.matchesCurrentOutcome).toBe(true);
  });

  it("excludes the live match from the leaderboard total", () => {
    const alice = out.leaderboard.find((l) => l.participantId === "alice")!;
    expect(alice.total).toBe(85); // 45 (finished A-1) + 40 (scorers); live A-2 adds nothing
  });
});

describe("computeScores — champion awarded at tournament end", () => {
  it("adds 250 when tournamentComplete and pick matches", () => {
    const input = makeInput();
    input.matches.tournamentComplete = true;
    input.matches.championTeamId = "a";
    const out = computeScores(input);
    const alice = out.leaderboard.find((l) => l.participantId === "alice")!;
    expect(alice.breakdown.champion).toBe(250);
    expect(alice.total).toBe(85 + 250);
  });
});
