import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { HashRouter } from "react-router-dom";

// --- minimal Supabase mock: enough rows for every page to render ----------
const rows: Record<string, unknown[]> = {
  teams: [
    { id: "a", name: "Aland", group_letter: "A", api_id: 1, fifa_rank: 5, logo: null },
    { id: "b", name: "Bland", group_letter: "A", api_id: 2, fifa_rank: 9, logo: null },
  ],
  players: [{ id: "a-1", name: "P. One", team_id: "a", position: "FWD", goal_multiplier: 8, api_id: 11 }],
  matches: [
    { id: "A-1", group_letter: "A", matchday: 1, kickoff: "2026-06-20T18:00:00Z", status: "SCHEDULED",
      home_team_id: "a", away_team_id: "b", goals: [], home_goals: null, away_goals: null, api_id: 100 },
    { id: "A-2", group_letter: "A", matchday: 1, kickoff: "2026-06-19T18:00:00Z", status: "FINISHED",
      home_team_id: "a", away_team_id: "b", home_goals: 2, away_goals: 1, api_id: 101,
      goals: [{ playerId: "a-1", apiPlayerId: 11, playerName: "P. One", minute: 10, teamId: "a", ownGoal: false }] },
  ],
  participants: [{ id: "x", name: "Xavi", match_scores: [{ matchId: "A-1", home: 1, away: 0 }], top_players: ["a-1"], champion: "a" }],
  score_history: [{ participant_id: "x", at: "2026-06-19T20:00:00Z", total: 45 }],
  documents: [
    { key: "scores", data: { updatedAt: "x", leaderboard: [{ participantId: "x", name: "Xavi", total: 45, rank: 1, breakdown: { exactScores: 15, outcomes: 30, standings: 0, scorers: 0, champion: 0 } }], perMatch: [], predictedStandings: [], scorerView: [{ participantId: "x", name: "Xavi", total: 8, picks: [{ playerId: "a-1", playerName: "P. One", teamId: "a", position: "FWD", multiplier: 8, goals: 1, points: 8 }] }], spiciness: [{ matchId: "A-1", kickoff: "2026-06-20T18:00:00Z", score: 9.1, maxSwing: 45, topOutcome: { home: 1, away: 1, spread: 45 } }] } },
    { key: "standings", data: { updatedAt: "x", groups: [{ group: "A", final: false, rows: [{ teamId: "a", pos: 1, played: 1, won: 1, drawn: 0, lost: 0, gf: 2, ga: 1, gd: 1, points: 3 }, { teamId: "b", pos: 2, played: 1, won: 0, drawn: 0, lost: 1, gf: 1, ga: 2, gd: -1, points: 0 }] }] } },
    { key: "bracket", data: { updatedAt: "x", rounds: [] } },
    { key: "stats", data: { updatedAt: "x", topScorers: [{ playerId: "a-1", apiId: 11, name: "P. One", teamId: "a", teamName: "Aland", position: "FWD", value: 1, goals: 1 }], topAssists: [], topCards: [] } },
    { key: "injuries", data: { updatedAt: "x", items: [] } },
    { key: "playerStats", data: { updatedAt: "x", players: { "a-1": { goals: 1, yellow: 0, red: 0, apps: 1 } } } },
  ],
};

function query(table: string) {
  const result = { data: rows[table] ?? [], error: null };
  const p = Promise.resolve(result) as Promise<typeof result> & { order: () => Promise<typeof result> };
  p.order = () => Promise.resolve(result);
  return p;
}
const channel = { on() { return channel; }, subscribe() { return channel; } };
vi.mock("./data/supabase", () => ({
  supabase: { from: (t: string) => ({ select: () => query(t) }), channel: () => channel, removeChannel: () => {} },
}));

import App from "./App";
import { DataProvider } from "./data/store";

afterEach(() => cleanup());
const renderApp = () => render(<HashRouter><DataProvider><App /></DataProvider></HashRouter>);

describe("app smoke test (supabase)", () => {
  it("loads and shows the leader on the Now page", async () => {
    renderApp();
    await waitFor(() => expect(screen.getByText("Barnito")).toBeTruthy());
    await waitFor(() => expect(screen.getByText(/Current leader/i)).toBeTruthy());
  });

  it("renders every page without crashing", async () => {
    renderApp();
    await waitFor(() => expect(screen.getByText("Barnito")).toBeTruthy());
    for (const [hash, expected] of [
      ["#/leaderboard", /Leaderboard/i], ["#/groups", /Group A/i],
      ["#/scorers", /Goal scorers/i], ["#/spicy", /Spicy/i], ["#/matches", /Group|Matchday|Knockouts/i],
    ] as [string, RegExp][]) {
      window.location.hash = hash;
      await waitFor(() => expect(screen.getAllByText(expected).length).toBeGreaterThan(0));
    }
  });
});
