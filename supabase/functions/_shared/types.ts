// AUTO-GENERATED from the repo source by scripts/sync-edge-shared.ts — do not edit.
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

export interface Venue {
  name: string | null;
  city: string | null;
  capacity?: number | null;
  image?: string | null;
}

export interface Team {
  id: string; // stable slug, e.g. "brazil"
  name: string;
  code?: string | null; // 3-letter code, e.g. "BRA"
  group: GroupLetter;
  apiId: number | null; // API-Football team id (null until resolved)
  logo?: string | null; // crest image URL (api-sports media)
  venue?: Venue | null;
  fifaRank?: number | null; // seeded; not from API-Football
}

export interface Player {
  id: string; // stable slug, e.g. "bra-vinicius-junior"
  apiId: number | null; // API-Football player id — the key used to match goal events
  name: string;
  teamId: string;
  position: Position;
  goalMultiplier: GoalMultiplier;
  photo?: string | null;
  number?: number | null;
  // Domestic club the player normally plays for. Backfilled lazily from API-Football for picked /
  // goalscoring players. null = not looked up yet; {} (no name) = looked up, none found.
  club?: { name: string | null; logo: string | null; league?: string | null } | null;
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

// Full event for the match timeline (goals already drive scoring via `goals`).
export type MatchEventType = "GOAL" | "CARD" | "SUBST" | "VAR";
export interface MatchEvent {
  minute: number | null;
  extraMinute?: number | null;
  teamId: string;
  type: MatchEventType;
  detail: string; // "Normal Goal" | "Own Goal" | "Penalty" | "Yellow Card" | "Red Card" | ...
  playerName: string;
  playerId: string | null;
  assistName?: string | null; // goal assist, or the player coming on for a sub
}

export interface LineupPlayer {
  playerId: string | null;
  name: string;
  number: number | null;
  pos: string | null; // "G" | "D" | "M" | "F"
  grid?: string | null; // "row:col" for pitch layout
}
export interface Lineup {
  teamId: string;
  formation: string | null; // "4-3-3"
  coach?: string | null;
  startXI: LineupPlayer[];
  subs: LineupPlayer[];
}

export interface TeamStat {
  teamId: string;
  items: { type: string; value: string | number | null }[]; // "Ball Possession" -> "57%"
}

export interface PlayerRating {
  playerId: string | null;
  name: string;
  teamId: string;
  rating: number | null; // 0..10
  number?: number | null;
  // richer per-match line (optional; populated for played matches with coverage)
  minutes?: number | null;
  captain?: boolean;
  goals?: number;
  assists?: number;
  shotsTotal?: number;
  shotsOn?: number;
  passes?: number;
  passAcc?: number | null; // %
  keyPasses?: number;
  tackles?: number;
  interceptions?: number;
  duelsTotal?: number;
  duelsWon?: number;
  dribbleAtt?: number;
  dribbleSucc?: number;
  foulsCommitted?: number;
  foulsDrawn?: number;
  yellow?: number;
  red?: number;
  penScored?: number;
  penMissed?: number;
  penWon?: number;
  penCommitted?: number;
  penSaved?: number;
}

export interface H2HMatch {
  date: string; // ISO
  homeName: string;
  awayName: string;
  homeGoals: number | null;
  awayGoals: number | null;
  league: string;
}

export interface Match {
  id: string; // stable id, e.g. "A-1" (group A, match 1) — also used in predictions
  apiId: number | null;
  group: GroupLetter;
  matchday: number; // 1..3 within the group
  kickoff: string; // ISO UTC
  ground?: string | null;
  venue?: Venue | null;
  homeTeamId: string;
  awayTeamId: string;
  status: MatchStatus;
  elapsed: number | null; // live minute
  homeGoals: number | null;
  awayGoals: number | null;
  goals: GoalEvent[];
  // rich display data (optional; populated for live/finished matches)
  events?: MatchEvent[];
  lineups?: Lineup[];
  stats?: TeamStat[];
  ratings?: PlayerRating[];
  h2h?: H2HMatch[]; // recent meetings between the two teams (mainly shown pre-match)
  // Captured at the venue during the match (live) or at kickoff time (backfilled), then frozen.
  weather?: {
    temp: number; // °C
    humidity: number; // %
    code: number; // WMO weather code
    wind: number; // km/h
    at: string; // ISO when captured
    coords?: { lat: number; lon: number };
  } | null;
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
  points: number; // awarded only once the match is FINISHED
  exact: boolean; // final: exact scoreline correct
  outcome: boolean; // final: correct result
  live: boolean; // match in progress
  matchesCurrentScore: boolean; // live: prediction equals the current scoreline
  matchesCurrentOutcome: boolean; // live: prediction has the current winner/draw
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

// ---------------------------------------------------------------------------
// stats.json — tournament leaders (golden boot etc.)
// ---------------------------------------------------------------------------

export interface PlayerStatLine {
  playerId: string | null; // roster id if matched (for "picked by you" highlight)
  apiId: number | null;
  name: string;
  teamId: string | null;
  teamName: string;
  photo?: string | null;
  position?: Position | null;
  value: number; // the headline number (goals / assists / cards)
  goals?: number;
  assists?: number;
  appearances?: number;
}

export interface StatsFile {
  updatedAt: string;
  topScorers: PlayerStatLine[];
  topAssists: PlayerStatLine[];
  topCards: PlayerStatLine[];
}

// ---------------------------------------------------------------------------
// injuries.json — availability flags for picked players
// ---------------------------------------------------------------------------

export interface InjuryItem {
  playerId: string | null;
  apiId: number | null;
  name: string;
  teamId: string | null;
  teamName: string;
  type: string; // "Missing Fixture" | "Questionable" ...
  reason: string;
}
export interface InjuriesFile {
  updatedAt: string;
  items: InjuryItem[];
}

// ---------------------------------------------------------------------------
// forecasts.json — API-Football's model prediction per upcoming match
// ---------------------------------------------------------------------------

export interface Forecast {
  matchId: string;
  winnerTeamId: string | null;
  winnerName: string | null;
  advice: string | null;
  percent: { home: number; draw: number; away: number }; // 0..100
}
export interface ForecastsFile {
  updatedAt: string;
  items: Forecast[];
}

// ---------------------------------------------------------------------------
// bracket.json — knockout rounds (populated as they're confirmed)
// ---------------------------------------------------------------------------

export interface BracketMatch {
  apiId: number | null;
  round: string;
  kickoff: string | null;
  ground?: string | null;
  homeTeamId: string | null; // null while TBD
  awayTeamId: string | null;
  homeName?: string | null; // placeholder label when a slot is undecided
  awayName?: string | null;
  status: MatchStatus;
  homeGoals: number | null;
  awayGoals: number | null;
}
export interface BracketRound {
  name: string;
  order: number;
  matches: BracketMatch[];
}
export interface BracketFile {
  updatedAt: string;
  rounds: BracketRound[];
}

// ---------------------------------------------------------------------------
// playerStats (per-player goals/cards/appearances) + score history
// ---------------------------------------------------------------------------

export interface PlayerCardStats {
  goals: number;
  yellow: number;
  red: number;
  apps: number;
  assists?: number;
  penScored?: number;
  penMissed?: number;
  penWon?: number;
  penCommitted?: number;
  penSaved?: number;
}
export interface PlayerStatsFile {
  updatedAt: string;
  players: Record<string, PlayerCardStats>; // keyed by player id
}

export interface ScoreHistoryPoint {
  participantId: string;
  at: string; // ISO
  total: number;
}

// Cumulative points after each finished match (kickoff order) — powers the points-over-matches chart.
export interface ScoreProgression {
  updatedAt: string;
  steps: { n: number; matchId: string; kickoff: string }[];
  totals: Record<string, number[]>; // participantId -> total after each step (aligned to steps)
}
