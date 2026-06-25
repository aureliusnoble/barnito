import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "./supabase";
import type {
  Roster, MatchesFile, PredictionsFile, StandingsFile, ScoresFile,
  StatsFile, InjuriesFile, BracketFile, PlayerStatsFile, ScoreHistoryPoint, ScoreProgression,
  Team, Player, Match, Participant, InjuryItem, GroupLetter, GoalEvent, MatchEvent,
  Lineup, TeamStat, PlayerRating, Position, GoalMultiplier,
} from "@shared/types";

export interface BarnitoData {
  roster: Roster;
  matches: MatchesFile;
  predictions: PredictionsFile;
  standings: StandingsFile;
  scores: ScoresFile;
  stats: StatsFile;
  injuries: InjuriesFile;
  bracket: BracketFile;
  playerStats: PlayerStatsFile;
  scoreHistory: ScoreHistoryPoint[];
  progression: ScoreProgression;
  // lookups
  teamById: Map<string, Team>;
  playerById: Map<string, Player>;
  matchById: Map<string, Match>;
  participantById: Map<string, Participant>;
  injuryByPlayerId: Map<string, InjuryItem>;
}

interface State { data: BarnitoData | null; loading: boolean; error: string | null }
const Ctx = createContext<State>({ data: null, loading: true, error: null });

type Row = Record<string, unknown>;

// --- row → type mappers ----------------------------------------------------
const rowToTeam = (r: Row): Team => ({
  id: r.id as string, name: r.name as string, code: (r.code as string) ?? null,
  group: (r.group_letter as GroupLetter) ?? ("?" as GroupLetter), apiId: (r.api_id as number) ?? null,
  logo: (r.logo as string) ?? null, venue: (r.venue as Team["venue"]) ?? null,
  fifaRank: (r.fifa_rank as number) ?? null,
});
const rowToPlayer = (r: Row): Player => ({
  id: r.id as string, apiId: (r.api_id as number) ?? null, name: r.name as string, teamId: r.team_id as string,
  position: (r.position as Position) ?? "FWD", goalMultiplier: (r.goal_multiplier as GoalMultiplier) ?? 8,
  photo: (r.photo as string) ?? null, number: (r.number as number) ?? null,
  age: (r.age as number) ?? null, ucl: (r.ucl as boolean) ?? false,
  uclCount: ((r.ucl_seasons as number[]) ?? []).length, uclKo: (r.ucl_ko as boolean) ?? false,
  wcBest: (r.wc_best as number) ?? 8,
  clubHistory: (r.club_history as Player["clubHistory"]) ?? null,
  club: (r.club as Player["club"]) ?? null,
});
const rowToMatch = (r: Row): Match => ({
  id: r.id as string, apiId: (r.api_id as number) ?? null,
  group: (r.group_letter as GroupLetter) ?? ("?" as GroupLetter), matchday: (r.matchday as number) ?? 1,
  kickoff: r.kickoff as string, ground: (r.ground as string) ?? null, venue: (r.venue as Match["venue"]) ?? null,
  homeTeamId: r.home_team_id as string, awayTeamId: r.away_team_id as string,
  status: (r.status as Match["status"]) ?? "SCHEDULED", elapsed: (r.elapsed as number) ?? null,
  homeGoals: (r.home_goals as number) ?? null, awayGoals: (r.away_goals as number) ?? null,
  goals: (r.goals as GoalEvent[]) ?? [], events: (r.events as MatchEvent[]) ?? undefined,
  lineups: (r.lineups as Lineup[]) ?? undefined, stats: (r.stats as TeamStat[]) ?? undefined,
  ratings: (r.ratings as PlayerRating[]) ?? undefined, h2h: (r.h2h as Match["h2h"]) ?? undefined,
  weather: (r.weather as Match["weather"]) ?? null,
  phase: (r.phase as Match["phase"]) ?? undefined,
});
const rowToParticipant = (r: Row): Participant => ({
  id: r.id as string, name: r.name as string, matchScores: (r.match_scores as Participant["matchScores"]) ?? [],
  topPlayers: (r.top_players as string[]) ?? [], scorersByRound: (r.scorers_by_round as Participant["scorersByRound"]) ?? undefined,
  champion: (r.champion as string) ?? "",
});

const EMPTY_SCORES: ScoresFile = { updatedAt: "", leaderboard: [], perMatch: [], predictedStandings: [], scorerView: [], spiciness: [] };

export function DataProvider({ children }: { children: ReactNode }) {
  const [teamRows, setTeamRows] = useState<Row[]>([]);
  const [playerRows, setPlayerRows] = useState<Row[]>([]);
  const [matchRows, setMatchRows] = useState<Row[]>([]);
  const [participantRows, setParticipantRows] = useState<Row[]>([]);
  const [docs, setDocs] = useState<Record<string, unknown>>({});
  const [history, setHistory] = useState<ScoreHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    // PostgREST returns at most 1000 rows per request; the players table (~2300) and score_history
    // (grows over time) exceed that, so page through them in full or the UI silently drops data.
    const selectAll = async (table: string, columns = "*", orderCol?: string): Promise<Row[]> => {
      const rows: Row[] = [];
      const size = 1000;
      for (let from = 0; ; from += size) {
        let qb = supabase.from(table).select(columns).range(from, from + size - 1);
        if (orderCol) qb = qb.order(orderCol, { ascending: true });
        const { data, error } = await qb;
        if (error) throw error;
        const d = (data ?? []) as unknown as Row[];
        rows.push(...d);
        if (d.length < size) break;
      }
      return rows;
    };
    (async () => {
      try {
        const [teams, players, matches, participants, docs, hist] = await Promise.all([
          selectAll("teams"),
          selectAll("players"),
          selectAll("matches"),
          selectAll("participants"),
          selectAll("documents", "key,data"),
          selectAll("score_history", "participant_id,at,total", "at"),
        ]);
        if (cancelled) return;
        setTeamRows(teams);
        setPlayerRows(players);
        setMatchRows(matches);
        setParticipantRows(participants);
        setDocs(Object.fromEntries(docs.map((row: Row) => [row.key as string, row.data])));
        setHistory(hist.map((r: Row) => ({ participantId: r.participant_id as string, at: r.at as string, total: r.total as number })));
        setLoading(false);
      } catch (e) {
        if (!cancelled) { setError((e as Error).message); setLoading(false); }
      }
    })();

    const upsertRow = (setter: typeof setMatchRows) => (payload: { eventType: string; new: Row; old: Row }) => {
      setter((prev) => {
        if (payload.eventType === "DELETE") return prev.filter((r) => r.id !== (payload.old as Row).id);
        const row = payload.new;
        const i = prev.findIndex((r) => r.id === row.id);
        if (i === -1) return [...prev, row];
        const next = prev.slice(); next[i] = row; return next;
      });
    };

    const channel = supabase
      .channel("barnito")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, (p) => upsertRow(setMatchRows)(p as never))
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, (p) => upsertRow(setTeamRows)(p as never))
      .on("postgres_changes", { event: "*", schema: "public", table: "participants" }, (p) => upsertRow(setParticipantRows)(p as never))
      .on("postgres_changes", { event: "*", schema: "public", table: "documents" }, (p) => {
        const row = (p as { new: Row }).new;
        if (row?.key) setDocs((prev) => ({ ...prev, [row.key as string]: row.data }));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "score_history" }, (p) => {
        const r = (p as { new: Row }).new;
        setHistory((prev) => [...prev, { participantId: r.participant_id as string, at: r.at as string, total: r.total as number }]);
      })
      .subscribe();

    // Realtime can silently drop — most commonly when a mobile tab is backgrounded (the websocket
    // closes), so the score/minute is frozen on return. Re-pull the live-changing tables when the
    // tab regains focus, and on a slow interval as a backstop if realtime is quiet.
    const refreshLive = async () => {
      try {
        const [m, d, h] = await Promise.all([
          selectAll("matches"),
          selectAll("documents", "key,data"),
          selectAll("score_history", "participant_id,at,total", "at"),
        ]);
        if (cancelled) return;
        setMatchRows(m);
        setDocs(Object.fromEntries(d.map((row: Row) => [row.key as string, row.data])));
        setHistory(h.map((r: Row) => ({ participantId: r.participant_id as string, at: r.at as string, total: r.total as number })));
      } catch { /* keep last good data */ }
    };
    const onVisible = () => { if (document.visibilityState === "visible") refreshLive(); };
    document.addEventListener("visibilitychange", onVisible);
    const pollId = window.setInterval(() => { if (document.visibilityState === "visible") refreshLive(); }, 30_000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(pollId);
    };
  }, []);

  const data = useMemo<BarnitoData | null>(() => {
    if (loading || error) return null;
    const teams = teamRows.map(rowToTeam);
    const players = playerRows.map(rowToPlayer);
    const matches = matchRows.map(rowToMatch).sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id));
    const participants = participantRows.map(rowToParticipant);
    const meta = (docs._meta as { tournamentComplete?: boolean; championTeamId?: string | null }) ?? {};
    const injuries = (docs.injuries as InjuriesFile) ?? { updatedAt: "", items: [] };
    // Freshest match-row write time — used to tick live clocks forward between snapshots.
    const matchesUpdatedAt = matchRows.reduce((max, r) => {
      const u = (r.updated_at as string) ?? "";
      return u > max ? u : max;
    }, "");
    return {
      roster: { updatedAt: "", teams, players },
      matches: { updatedAt: matchesUpdatedAt, tournamentComplete: meta.tournamentComplete ?? false, championTeamId: meta.championTeamId ?? null, matches },
      predictions: { updatedAt: "", participants },
      standings: (docs.standings as StandingsFile) ?? { updatedAt: "", groups: [] },
      scores: (docs.scores as ScoresFile) ?? EMPTY_SCORES,
      stats: (docs.stats as StatsFile) ?? { updatedAt: "", topScorers: [], topAssists: [], topCards: [] },
      injuries,
      bracket: (docs.bracket as BracketFile) ?? { updatedAt: "", rounds: [] },
      playerStats: (docs.playerStats as PlayerStatsFile) ?? { updatedAt: "", players: {} },
      scoreHistory: history,
      progression: (docs.progression as ScoreProgression) ?? { updatedAt: "", steps: [], totals: {} },
      teamById: new Map(teams.map((t) => [t.id, t])),
      playerById: new Map(players.map((p) => [p.id, p])),
      matchById: new Map(matches.map((m) => [m.id, m])),
      participantById: new Map(participants.map((p) => [p.id, p])),
      injuryByPlayerId: new Map(injuries.items.filter((i) => i.playerId).map((i) => [i.playerId as string, i])),
    };
  }, [loading, error, teamRows, playerRows, matchRows, participantRows, docs, history]);

  return <Ctx.Provider value={{ data, loading, error }}>{children}</Ctx.Provider>;
}

export function useBarnito(): BarnitoData {
  const { data } = useContext(Ctx);
  if (!data) throw new Error("Barnito data not loaded");
  return data;
}
export function useDataState(): State { return useContext(Ctx); }

export function useHelpers() {
  const d = useBarnito();
  return useMemo(() => ({
    teamName: (id: string) => d.teamById.get(id)?.name ?? id,
    teamGroup: (id: string) => d.teamById.get(id)?.group ?? "?",
    playerName: (id: string) => d.playerById.get(id)?.name ?? id,
    participantName: (id: string) => d.participantById.get(id)?.name ?? id,
  }), [d]);
}
