// Shared data contract between the data pipeline (scripts/) and the frontend (src/).
// All files live in public/data/*.json. Keep these shapes stable; the GitHub Action
// writes them and the React app only ever reads them.

export type GroupLetter =
  | "A" | "B" | "C" | "D" | "E" | "F"
  | "G" | "H" | "I" | "J" | "K" | "L";

export type Position = "GK" | "DEF" | "MID" | "FWD";

/** Per-goal multiplier by position (per scoring rules). */
export type GoalMultiplier = 32 | 16 | 8;

export type MatchStatus = "SCHEDULED" | "LIVE" | "HT" | "FINISHED";

// ---------------------------------------------------------------------------
// roster.json
// ---------------------------------------------------------------------------

export interface Team {
  id: string; // stable slug, e.g. "brazil"
  name: string;
  group: GroupLetter;
  apiId: number | null; // API-Football team id (null until resolved)
  flag?: string | null; // optional flag image URL
}

export interface Player {
  id: string; // stable slug, e.g. "bra-vinicius-junior"
  apiId: number | null; // API-Football player id — the key used to match goal events
  name: string;
  teamId: string;
  position: Position;
  goalMultiplier: GoalMultiplier;
  photo?: string | null;
}

export interface Roster {
  updatedAt: string;
  teams: Team[];
  players: Player[];
}

// ---------------------------------------------------------------------------
// matches.json
// ---------------------------------------------------------------------------

export interface GoalEvent {
  playerId: string | null; // roster player id (null if unmatched)
  apiPlayerId: number | null;
  playerName: string; // raw name as reported (for display / debugging)
  minute: number | null;
  teamId: string; // team credited with the goal
  ownGoal: boolean;
}

export interface Match {
  id: string; // stable id, e.g. "A-1" (group A, match 1) — also used in predictions
  apiId: number | null;
  group: GroupLetter;
  matchday: number; // 1..3 within the group
  kickoff: string; // ISO UTC
  ground?: string | null;
  homeTeamId: string;
  awayTeamId: string;
  status: MatchStatus;
  elapsed: number | null; // live minute
  homeGoals: number | null;
  awayGoals: number | null;
  goals: GoalEvent[];
}

export interface MatchesFile {
  updatedAt: string;
  /** True once the final is played; flips on the champion +250. Set via overrides. */
  tournamentComplete: boolean;
  /** Actual champion team id (set via overrides once known). */
  championTeamId: string | null;
  matches: Match[];
}

// ---------------------------------------------------------------------------
// predictions.json
// ---------------------------------------------------------------------------

export interface MatchScorePrediction {
  matchId: string;
  home: number;
  away: number;
}

export interface Participant {
  id: string; // slug from name
  name: string;
  matchScores: MatchScorePrediction[];
  topPlayers: string[]; // up to 6 roster player ids
  champion: string; // team id
}

export interface PredictionsFile {
  updatedAt: string;
  participants: Participant[];
}

// ---------------------------------------------------------------------------
// standings.json (actual group tables)
// ---------------------------------------------------------------------------

export interface StandingRow {
  teamId: string;
  pos: number; // 1..4
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

export interface GroupStanding {
  group: GroupLetter;
  rows: StandingRow[];
  final: boolean; // true once all 6 group matches are FINISHED
}

export interface StandingsFile {
  updatedAt: string;
  groups: GroupStanding[];
}

// ---------------------------------------------------------------------------
// scores.json (everything the UI reads for points)
// ---------------------------------------------------------------------------

export interface ScoreBreakdown {
  exactScores: number;
  outcomes: number;
  standings: number;
  scorers: number;
  champion: number;
}

export interface LeaderboardEntry {
  participantId: string;
  name: string;
  total: number;
  breakdown: ScoreBreakdown;
  rank: number;
}

export interface MatchPredictionResult {
  participantId: string;
  name: string;
  predHome: number | null;
  predAway: number | null;
  points: number;
  exact: boolean;
  outcome: boolean;
  provisional: boolean; // true while the match is live/not final
}

export interface PerMatchScores {
  matchId: string;
  predictions: MatchPredictionResult[];
}

export interface PredictedGroupStanding {
  group: GroupLetter;
  orderedTeamIds: string[];
  correctPositions: number;
  points: number;
  counted: boolean; // true once the group is final and points are locked
}

export interface PredictedStandings {
  participantId: string;
  name: string;
  groups: PredictedGroupStanding[];
}

export interface ScorerPick {
  playerId: string;
  playerName: string;
  teamId: string;
  position: Position;
  multiplier: GoalMultiplier;
  goals: number;
  points: number;
}

export interface ScorerView {
  participantId: string;
  name: string;
  picks: ScorerPick[];
  total: number;
}

export interface SpicyMatch {
  matchId: string;
  kickoff: string;
  score: number; // average spread of points across candidate outcomes
  maxSwing: number; // biggest possible point gap between participants
  topOutcome: { home: number; away: number; spread: number } | null;
}

export interface ScoresFile {
  updatedAt: string;
  leaderboard: LeaderboardEntry[];
  perMatch: PerMatchScores[];
  predictedStandings: PredictedStandings[];
  scorerView: ScorerView[];
  spiciness: SpicyMatch[];
}
