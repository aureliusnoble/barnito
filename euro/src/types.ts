// Barnito 28 — shared types. The whole app (store, engine, pages) builds on these.

export type EPhase = "group" | "r16" | "qf" | "sf" | "final";
export type EGroup = "A" | "B" | "C" | "D" | "E" | "F";
export type Outcome = "H" | "D" | "A";
export type FixtureStatus = "SCHEDULED" | "FINISHED";

export interface ETeam {
  id: string; // slug, e.g. "spain"
  name: string;
  code: string; // 3-letter, e.g. "ESP"
  group: EGroup;
  rating: number; // Elo-ish 1500–2100 — drives all mock odds
  color: string; // hex accent used for kit dots / bracket
  flag: string; // emoji flag
}

export interface EPlayer {
  id: string; // slug, e.g. "spain-lamine-yamal"
  name: string;
  teamId: string;
  rating: number; // 60–99 scoring threat — drives anytime-scorer odds
}

export interface ScorerLine {
  playerId: string;
  count: number; // goals in this fixture
}

export interface EFixture {
  id: string; // "g-A1".."g-F6", "r16-1".."r16-8", "qf-1".."qf-4", "sf-1","sf-2","final"
  phase: EPhase;
  group?: EGroup; // group fixtures only
  kickoff: string; // ISO UTC
  venue: string;
  city: string;
  homeTeamId: string | null; // null until the bracket fills the slot
  awayTeamId: string | null;
  homeLabel?: string; // placeholder while null, e.g. "Winner A"
  awayLabel?: string;
  status: FixtureStatus;
  homeGoals: number | null;
  awayGoals: number | null;
  scorers: ScorerLine[]; // forwards credited with this fixture's goals
  penWinnerTeamId?: string | null; // knockout only: shootout winner when still level after extra time
}

// ---------------------------------------------------------------------------
// Predictions. Drafts are freely editable; locking snapshots odds and is final.
// Only locked predictions ever score.
// ---------------------------------------------------------------------------

export interface OutcomePrediction {
  pick: Outcome;
  locked: boolean;
  lockedAt?: string;
  odds?: number; // decimal odds of the picked outcome, frozen at lock
  prob?: number; // implied probability at lock (0..1)
}

export interface ScorerPrediction {
  playerIds: string[];
  locked: boolean;
  lockedAt?: string;
  oddsByPlayer?: Record<string, number>; // frozen at lock
}

export interface TokenAssign {
  fixtureId: string;
  teamId: string;
  count: number; // tokens on this team in this fixture
}

export interface TokenPrediction {
  assigns: TokenAssign[];
  locked: boolean;
  lockedAt?: string;
  oddsByAssign?: Record<string, number>; // key `${fixtureId}:${teamId}`, frozen at lock
}

export interface ChampionPrediction {
  teamId: string;
  locked: boolean;
  lockedAt?: string;
  outrightOdds?: number; // display-only snapshot
}

export interface UserPredictions {
  outcomes: Record<string, OutcomePrediction>; // by fixtureId
  scorers: Partial<Record<EPhase, ScorerPrediction>>;
  tokens: Partial<Record<EPhase, TokenPrediction>>;
  champion: ChampionPrediction | null;
}

export interface EUser {
  id: string;
  name: string;
  isAdmin: boolean;
  pin?: string;
  emoji: string; // avatar
}

// ---------------------------------------------------------------------------
// Persisted state — one localStorage blob for everything (mock backend).
// ---------------------------------------------------------------------------

export interface Euro28State {
  version: number;
  users: EUser[];
  sessionUserId: string | null;
  fixtures: EFixture[]; // seeded from data/fixtures.ts, then admin-mutated
  predictions: Record<string, UserPredictions>; // by userId
  admin: {
    simNow: string | null; // ISO — null means real time
  };
}

// ---------------------------------------------------------------------------
// Derived scoring output (computed, never stored).
// ---------------------------------------------------------------------------

export interface OutcomeScoreLine {
  fixtureId: string;
  pick: Outcome;
  correct: boolean;
  odds: number;
  points: number;
}

export interface ScorerScoreLine {
  phase: EPhase;
  playerId: string;
  goals: number;
  odds: number;
  points: number;
}

export interface TokenScoreLine {
  phase: EPhase;
  fixtureId: string;
  teamId: string;
  count: number;
  netDiff: number; // signed
  odds: number;
  points: number; // signed
}

export interface UserScore {
  userId: string;
  name: string;
  total: number;
  outcomes: number;
  scorers: number;
  tokens: number;
  champion: number;
  outcomeLines: OutcomeScoreLine[];
  scorerLines: ScorerScoreLine[];
  tokenLines: TokenScoreLine[];
  championCorrect: boolean;
  rank: number;
}

export interface OutcomeOdds {
  probs: Record<Outcome, number>; // sums to 1
  odds: Record<Outcome, number>; // decimal, = 1/p rounded to 2dp
}
