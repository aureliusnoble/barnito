import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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

interface State { data: BarnitoData | null; loading: boolean; error: string | null; ensureClubHistory: () => void }
const Ctx = createContext<State>({ data: null, loading: true, error: null, ensureClubHistory: () => {} });

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
  penHome: (r.pen_home as number) ?? null, penAway: (r.pen_away as number) ?? null,
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

// Light match columns for the polling backstop — everything the lists/cards/scoring need, but NOT the
// heavy per-match jsonb (lineups, events, stats, ratings, h2h, weather), which is ~90% of the row and
// only used in the match modal / Daily / Best XI. The initial load still pulls those once; the 30s
// poll merges just these light fields so we don't re-transfer megabytes of unchanged detail.
const MATCH_LIGHT_COLS = "id,api_id,group_letter,matchday,kickoff,status,elapsed,home_team_id,away_team_id,home_goals,away_goals,pen_home,pen_away,ground,venue,goals,phase,updated_at";
// Player columns minus club_history (~1.26 MB, used only by the Daily game) — that's lazy-loaded and cached separately.
const PLAYER_LIGHT_COLS = "id,api_id,name,team_id,position,goal_multiplier,photo,number,age,ucl,ucl_seasons,ucl_ko,wc_best,club";

// PostgREST caps a response at 1000 rows; the players table (~2300) and score_history (grows over
// time) exceed that, so page through them in full or the UI silently drops data.
async function selectAll(table: string, columns = "*", orderCol?: string): Promise<Row[]> {
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
}

// localStorage cache for the static-ish roster so returning visitors don't re-download it every load
// (a big chunk of the free-tier egress). Versioned + TTL'd; any failure falls back to a network fetch.
const CACHE_VERSION = 1;
const DAY_MS = 86_400_000;
const CK_TEAMS = "barnito.cache.teams.v1";
const CK_PLAYERS = "barnito.cache.players.v1";
const CK_CLUBHIST = "barnito.cache.clubHistory.v1";
function cacheGet<T>(key: string, maxAgeMs: number): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const o = JSON.parse(raw) as { v: number; t: number; data: T };
    if (o.v !== CACHE_VERSION || Date.now() - o.t > maxAgeMs) return null;
    return o.data;
  } catch { return null; }
}
function cacheSet(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify({ v: CACHE_VERSION, t: Date.now(), data })); } catch { /* quota / disabled */ }
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [teamRows, setTeamRows] = useState<Row[]>([]);
  const [playerRows, setPlayerRows] = useState<Row[]>([]);
  const [matchRows, setMatchRows] = useState<Row[]>([]);
  const [participantRows, setParticipantRows] = useState<Row[]>([]);
  const [docs, setDocs] = useState<Record<string, unknown>>({});
  const [history, setHistory] = useState<ScoreHistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Latest match rows, for the poll's liveness gate (avoids re-subscribing the realtime effect).
  const matchRowsRef = useRef<Row[]>([]);
  matchRowsRef.current = matchRows;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // teams + (light) players are static-ish: serve from localStorage when fresh and skip the
        // network entirely, so a returning visitor downloads only the live tables.
        const cTeams = cacheGet<Row[]>(CK_TEAMS, DAY_MS);
        const cPlayers = cacheGet<Row[]>(CK_PLAYERS, DAY_MS);
        const [teams, players, matches, participants, docs, hist] = await Promise.all([
          cTeams ?? selectAll("teams"),
          cPlayers ?? selectAll("players", PLAYER_LIGHT_COLS),
          selectAll("matches"),
          selectAll("participants"),
          selectAll("documents", "key,data"),
          selectAll("score_history", "participant_id,at,total", "at"),
        ]);
        if (cancelled) return;
        if (!cTeams) cacheSet(CK_TEAMS, teams);
        if (!cPlayers) cacheSet(CK_PLAYERS, players);
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
    // tab regains focus, and on a slow interval as a backstop if realtime is quiet. Crucially, this
    // pulls only the LIGHT match columns and merges them onto the rows we already have, so the poll
    // never re-transfers the heavy per-match detail (lineups/ratings/etc.) — that's the difference
    // between a few KB and ~600 KB every cycle. Live detail still arrives via realtime on change.
    const refreshLive = async () => {
      try {
        const [m, d, h] = await Promise.all([
          selectAll("matches", MATCH_LIGHT_COLS),
          selectAll("documents", "key,data"),
          selectAll("score_history", "participant_id,at,total", "at"),
        ]);
        if (cancelled) return;
        setMatchRows((prev) => {
          const byId = new Map(prev.map((r) => [r.id as string, r]));
          for (const lr of m) {
            const ex = byId.get(lr.id as string);
            byId.set(lr.id as string, ex ? { ...ex, ...lr } : lr); // overlay light fields, keep heavy detail
          }
          return [...byId.values()];
        });
        setDocs(Object.fromEntries(d.map((row: Row) => [row.key as string, row.data])));
        setHistory(h.map((r: Row) => ({ participantId: r.participant_id as string, at: r.at as string, total: r.total as number })));
      } catch { /* keep last good data */ }
    };
    // Poll hard only when a match is live or imminent; otherwise back off to a ~10-min heartbeat so an
    // idle open tab isn't re-pulling every 30s. Realtime + the visibility refresh cover the rest.
    const liveSoon = () => matchRowsRef.current.some((r) => {
      const s = r.status as string;
      if (s === "LIVE" || s === "HT") return true;
      if (s !== "SCHEDULED") return false;
      const toKo = Date.parse(r.kickoff as string) - Date.now();
      return toKo < 75 * 60 * 1000 && toKo > -3 * 60 * 60 * 1000;
    });
    const onVisible = () => { if (document.visibilityState === "visible") refreshLive(); };
    document.addEventListener("visibilitychange", onVisible);
    let ticks = 0;
    const pollId = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      ticks++;
      if (liveSoon() || ticks % 20 === 0) refreshLive(); // every 30s when live, else ~every 10 min
    }, 30_000);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
      window.clearInterval(pollId);
    };
  }, []);

  // Lazy-load the big club_history blob (only the Daily game needs it). Served from localStorage when
  // present, otherwise fetched once and cached, then merged into the player rows. No-op after the first call.
  const clubHistRef = useRef(false);
  const ensureClubHistory = useCallback(() => {
    if (clubHistRef.current) return;
    clubHistRef.current = true;
    (async () => {
      let map = cacheGet<Record<string, unknown>>(CK_CLUBHIST, 30 * DAY_MS);
      if (!map) {
        try {
          const rows = await selectAll("players", "id,club_history");
          map = Object.fromEntries(rows.map((r) => [r.id as string, (r.club_history as unknown) ?? null]));
          cacheSet(CK_CLUBHIST, map);
        } catch { clubHistRef.current = false; return; } // let a later mount retry
      }
      const ch = map;
      setPlayerRows((prev) => prev.map((r) => (ch[r.id as string] != null ? { ...r, club_history: ch[r.id as string] } : r)));
    })();
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

  return <Ctx.Provider value={{ data, loading, error, ensureClubHistory }}>{children}</Ctx.Provider>;
}

export function useBarnito(): BarnitoData {
  const { data } = useContext(Ctx);
  if (!data) throw new Error("Barnito data not loaded");
  return data;
}
export function useDataState(): State { return useContext(Ctx); }
/** Trigger the one-time lazy load of player club history (used by the Daily game). */
export function useEnsureClubHistory(): () => void { return useContext(Ctx).ensureClubHistory; }

export function useHelpers() {
  const d = useBarnito();
  return useMemo(() => ({
    teamName: (id: string) => d.teamById.get(id)?.name ?? id,
    teamGroup: (id: string) => d.teamById.get(id)?.group ?? "?",
    playerName: (id: string) => d.playerById.get(id)?.name ?? id,
    participantName: (id: string) => d.participantById.get(id)?.name ?? id,
  }), [d]);
}
