// AUTO-GENERATED from the repo source by scripts/sync-edge-shared.ts — do not edit.
import type {
  Roster,
  MatchesFile,
  PredictionsFile,
  StandingsFile,
  ScoresFile,
  Match,
  Participant,
  Player,
  ScoreBreakdown,
  MatchPredictionResult,
  PredictedGroupStanding,
  ScorerPick,
  SpicyMatch,
  GroupLetter,
  Phase,
} from "./types.ts";
import {
  POINTS_EXACT,
  POINTS_OUTCOME,
  POINTS_CHAMPION,
  POINTS_PER_CORRECT_STANDING,
  SPICY_MAX_GOALS,
  ROUND_FACTOR,
} from "./constants.ts";
import { computeGroupTable, type GroupResult } from "./standings.ts";

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

const PHASES: Phase[] = ["group", "r32", "r16", "qf", "sf", "final"];
/** A match's scoring phase, or null if it isn't scored (3rd-place match). Group matches default in. */
function phaseOf(m: Match): Phase | null {
  if (!m.phase) return "group";
  return m.phase === "none" ? null : m.phase;
}
/** Per-match scoring factor (×1 group … ×6 final); 0 for non-scored matches. */
function factorOf(m: Match): number {
  const ph = phaseOf(m);
  return ph ? ROUND_FACTOR[ph] : 0;
}
/** A participant's scorer picks for a phase (group falls back to legacy topPlayers). */
function scorersFor(p: { topPlayers: string[]; scorersByRound?: Partial<Record<Phase, string[]>> }, ph: Phase): string[] {
  return ph === "group" ? p.scorersByRound?.group ?? p.topPlayers : p.scorersByRound?.[ph] ?? [];
}

export interface MatchPoints {
  points: number;
  exact: boolean;
  outcome: boolean;
}

/** Core rule: exact scoreline = 45 (15 + 30), correct outcome only = 30, else 0. */
export function matchPoints(
  predHome: number,
  predAway: number,
  actualHome: number,
  actualAway: number,
): MatchPoints {
  const exact = predHome === actualHome && predAway === actualAway;
  const outcome = sign(predHome - predAway) === sign(actualHome - actualAway);
  let points = 0;
  if (outcome) points += POINTS_OUTCOME;
  if (exact) points += POINTS_EXACT;
  return { points, exact, outcome };
}

/** A match has a usable score once it is live or finished. */
export function isScored(m: Match): boolean {
  return (
    (m.status === "LIVE" || m.status === "HT" || m.status === "FINISHED") &&
    m.homeGoals !== null &&
    m.awayGoals !== null
  );
}

export function mean(xs: number[]): number {
  if (xs.length === 0) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function stdev(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
}

// ---------------------------------------------------------------------------

export interface ScoringInput {
  roster: Roster;
  matches: MatchesFile;
  predictions: PredictionsFile;
  standings: StandingsFile;
}

export function computeScores(input: ScoringInput): ScoresFile {
  const { roster, matches, predictions, standings } = input;
  const teamName = new Map(roster.teams.map((t) => [t.id, t.name]));
  const fifaRankByTeam = new Map(roster.teams.map((t) => [t.id, t.fifaRank ?? 999]));
  const playerById = new Map<string, Player>(roster.players.map((p) => [p.id, p]));
  const matchById = new Map(matches.matches.map((m) => [m.id, m]));

  // Quick lookup: participant -> matchId -> predicted score
  const predByParticipant = new Map<string, Map<string, { home: number; away: number }>>();
  for (const p of predictions.participants) {
    const m = new Map<string, { home: number; away: number }>();
    for (const s of p.matchScores) m.set(s.matchId, { home: s.home, away: s.away });
    predByParticipant.set(p.id, m);
  }

  // --- per-match results --------------------------------------------------
  // Points are awarded ONLY when a match is FINISHED. While live we surface highlight
  // flags (prediction matches the current scoreline / current result) but award nothing.
  const perMatch = matches.matches.map((match) => {
    const finished = match.status === "FINISHED" && match.homeGoals !== null && match.awayGoals !== null;
    const live = isScored(match) && !finished;
    const factor = factorOf(match); // ×1 group … ×6 final, 0 if not scored
    const preds: MatchPredictionResult[] = predictions.participants.map((p) => {
      const pred = predByParticipant.get(p.id)?.get(match.id);
      const base = {
        participantId: p.id,
        name: p.name,
        predHome: pred ? pred.home : null,
        predAway: pred ? pred.away : null,
        points: 0,
        exact: false,
        outcome: false,
        live,
        matchesCurrentScore: false,
        matchesCurrentOutcome: false,
      };
      if (!pred) return base;
      if (finished) {
        const mp = matchPoints(pred.home, pred.away, match.homeGoals!, match.awayGoals!);
        return { ...base, points: mp.points * factor, exact: mp.exact, outcome: mp.outcome };
      }
      if (live) {
        const mp = matchPoints(pred.home, pred.away, match.homeGoals!, match.awayGoals!);
        return { ...base, matchesCurrentScore: mp.exact, matchesCurrentOutcome: mp.outcome };
      }
      return base;
    });
    // sort: finished by points; live so current-score matches float up; else by name
    preds.sort((a, b) => {
      if (finished) return b.points - a.points || a.name.localeCompare(b.name);
      if (live) {
        const rank = (x: MatchPredictionResult) =>
          (x.matchesCurrentScore ? 2 : 0) + (x.matchesCurrentOutcome ? 1 : 0);
        return rank(b) - rank(a) || a.name.localeCompare(b.name);
      }
      return a.name.localeCompare(b.name);
    });
    return { matchId: match.id, predictions: preds };
  });

  // --- scorer view --------------------------------------------------------
  // Goals per player, per phase. Own goals don't count; shootout goals (no elapsed minute) don't
  // count; only FINISHED matches contribute. A pick scores only in its own phase's matches.
  const goalsByPhase = new Map<Phase, Map<string, number>>();
  for (const m of matches.matches) {
    if (m.status !== "FINISHED") continue;
    const ph = phaseOf(m);
    if (!ph) continue; // non-scored match (3rd place)
    const gp = goalsByPhase.get(ph) ?? new Map<string, number>();
    goalsByPhase.set(ph, gp);
    for (const g of m.goals) {
      if (g.ownGoal || !g.playerId || g.minute == null) continue; // own goal / unmatched / shootout
      gp.set(g.playerId, (gp.get(g.playerId) ?? 0) + 1);
    }
  }

  const scorerView = predictions.participants.map((p) => {
    const picks: ScorerPick[] = [];
    for (const ph of PHASES) {
      const factor = ROUND_FACTOR[ph];
      for (const playerId of scorersFor(p, ph)) {
        const player = playerById.get(playerId);
        const goals = goalsByPhase.get(ph)?.get(playerId) ?? 0;
        const multiplier = (player?.goalMultiplier ?? 8) * factor;
        picks.push({
          playerId,
          playerName: player?.name ?? playerId,
          teamId: player?.teamId ?? "",
          position: player?.position ?? "FWD",
          phase: ph,
          multiplier,
          goals,
          points: goals * multiplier,
        });
      }
    }
    return {
      participantId: p.id,
      name: p.name,
      picks,
      total: picks.reduce((a, b) => a + b.points, 0),
    };
  });

  // --- predicted standings ------------------------------------------------
  const teamsByGroup = new Map<GroupLetter, string[]>();
  for (const t of roster.teams) {
    const arr = teamsByGroup.get(t.group) ?? [];
    arr.push(t.id);
    teamsByGroup.set(t.group, arr);
  }
  const matchesByGroup = new Map<GroupLetter, Match[]>();
  for (const m of matches.matches) {
    const arr = matchesByGroup.get(m.group) ?? [];
    arr.push(m);
    matchesByGroup.set(m.group, arr);
  }
  const actualByGroup = new Map(standings.groups.map((g) => [g.group, g]));

  const predictedStandings = predictions.participants.map((p) => {
    const predMap = predByParticipant.get(p.id)!;
    const groups: PredictedGroupStanding[] = [];
    for (const [group, teamIds] of teamsByGroup) {
      const groupMatches = matchesByGroup.get(group) ?? [];
      const results: GroupResult[] = [];
      for (const gm of groupMatches) {
        const pred = predMap.get(gm.id);
        if (!pred) continue;
        results.push({
          homeTeamId: gm.homeTeamId,
          awayTeamId: gm.awayTeamId,
          homeGoals: pred.home,
          awayGoals: pred.away,
        });
      }
      const predTable = computeGroupTable(teamIds, results, (id) => teamName.get(id) ?? id, (id) => fifaRankByTeam.get(id) ?? 999);
      const orderedTeamIds = predTable.map((r) => r.teamId);

      const actual = actualByGroup.get(group);
      const actualOrder = actual ? actual.rows.map((r) => r.teamId) : [];
      const counted = actual?.final ?? false;
      let correctPositions = 0;
      if (counted) {
        for (let i = 0; i < orderedTeamIds.length; i++) {
          if (orderedTeamIds[i] === actualOrder[i]) correctPositions++;
        }
      }
      groups.push({
        group,
        orderedTeamIds,
        correctPositions,
        points: counted ? correctPositions * POINTS_PER_CORRECT_STANDING : 0,
        counted,
      });
    }
    groups.sort((a, b) => a.group.localeCompare(b.group));
    return { participantId: p.id, name: p.name, groups };
  });

  // --- spiciness (upcoming matches) ---------------------------------------
  const spiciness: SpicyMatch[] = [];
  for (const match of matches.matches) {
    if (match.status !== "SCHEDULED") continue;
    const participantPreds = predictions.participants
      .map((p) => predByParticipant.get(p.id)?.get(match.id))
      .filter((x): x is { home: number; away: number } => !!x);
    if (participantPreds.length < 2) continue;

    const spreads: number[] = [];
    let maxSwing = 0;
    let topOutcome: SpicyMatch["topOutcome"] = null;
    for (let h = 0; h <= SPICY_MAX_GOALS; h++) {
      for (let a = 0; a <= SPICY_MAX_GOALS; a++) {
        const pts = participantPreds.map((pred) => matchPoints(pred.home, pred.away, h, a).points);
        const sd = stdev(pts);
        const swing = Math.max(...pts) - Math.min(...pts);
        spreads.push(sd);
        if (swing > maxSwing || (swing === maxSwing && topOutcome === null)) {
          maxSwing = swing;
          topOutcome = { home: h, away: a, spread: swing };
        }
      }
    }
    spiciness.push({
      matchId: match.id,
      kickoff: match.kickoff,
      score: Number(mean(spreads).toFixed(2)),
      maxSwing,
      topOutcome,
    });
  }
  spiciness.sort((a, b) => b.score - a.score || a.kickoff.localeCompare(b.kickoff));

  // --- leaderboard --------------------------------------------------------
  const standingsPointsByParticipant = new Map<string, number>();
  for (const ps of predictedStandings) {
    standingsPointsByParticipant.set(
      ps.participantId,
      ps.groups.reduce((a, g) => a + g.points, 0),
    );
  }
  const scorerPointsByParticipant = new Map(scorerView.map((s) => [s.participantId, s.total]));

  const championOf = (p: Participant) =>
    matches.tournamentComplete && matches.championTeamId && p.champion === matches.championTeamId
      ? POINTS_CHAMPION
      : 0;

  // tally exact/outcome points per participant from perMatch
  const exactByP = new Map<string, number>();
  const outcomeByP = new Map<string, number>();
  for (const pm of perMatch) {
    const match = matchById.get(pm.matchId);
    if (!match || match.status !== "FINISHED") continue;
    const factor = factorOf(match);
    if (!factor) continue; // non-scored match (3rd place)
    for (const r of pm.predictions) {
      if (r.exact) exactByP.set(r.participantId, (exactByP.get(r.participantId) ?? 0) + POINTS_EXACT * factor);
      if (r.outcome)
        outcomeByP.set(r.participantId, (outcomeByP.get(r.participantId) ?? 0) + POINTS_OUTCOME * factor);
    }
  }

  const leaderboard = predictions.participants
    .map((p) => {
      const breakdown: ScoreBreakdown = {
        exactScores: exactByP.get(p.id) ?? 0,
        outcomes: outcomeByP.get(p.id) ?? 0,
        standings: standingsPointsByParticipant.get(p.id) ?? 0,
        scorers: scorerPointsByParticipant.get(p.id) ?? 0,
        champion: championOf(p),
      };
      const total =
        breakdown.exactScores +
        breakdown.outcomes +
        breakdown.standings +
        breakdown.scorers +
        breakdown.champion;
      return { participantId: p.id, name: p.name, total, breakdown, rank: 0 };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  // dense-ish ranking with ties sharing a rank
  let lastTotal: number | null = null;
  let lastRank = 0;
  leaderboard.forEach((e, idx) => {
    if (lastTotal === null || e.total !== lastTotal) {
      lastRank = idx + 1;
      lastTotal = e.total;
    }
    e.rank = lastRank;
  });

  return {
    updatedAt: new Date().toISOString(),
    leaderboard,
    perMatch,
    predictedStandings,
    scorerView,
    spiciness,
  };
}
