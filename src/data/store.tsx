import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  Roster, MatchesFile, PredictionsFile, StandingsFile, ScoresFile,
  StatsFile, InjuriesFile, ForecastsFile,
  Team, Player, Match, Participant, InjuryItem, Forecast,
} from "@shared/types";

export interface BarnitoData {
  roster: Roster;
  matches: MatchesFile;
  predictions: PredictionsFile;
  standings: StandingsFile;
  scores: ScoresFile;
  stats: StatsFile;
  injuries: InjuriesFile;
  forecasts: ForecastsFile;
  // lookups
  teamById: Map<string, Team>;
  playerById: Map<string, Player>;
  matchById: Map<string, Match>;
  participantById: Map<string, Participant>;
  injuryByPlayerId: Map<string, InjuryItem>;
  forecastByMatchId: Map<string, Forecast>;
}

interface State {
  data: BarnitoData | null;
  loading: boolean;
  error: string | null;
}

const Ctx = createContext<State>({ data: null, loading: true, error: null });

async function fetchJson<T>(file: string, bust: number): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}?v=${bust}`);
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return (await res.json()) as T;
}

/** Optional data files — return a fallback if they don't exist yet. */
async function fetchOptional<T>(file: string, fallback: T, bust: number): Promise<T> {
  try {
    return await fetchJson<T>(file, bust);
  } catch {
    return fallback;
  }
}

async function loadAll(bust: number): Promise<BarnitoData> {
  const [roster, matches, predictions, standings, scores, stats, injuries, forecasts] =
    await Promise.all([
      fetchJson<Roster>("roster.json", bust),
      fetchJson<MatchesFile>("matches.json", bust),
      fetchJson<PredictionsFile>("predictions.json", bust),
      fetchJson<StandingsFile>("standings.json", bust),
      fetchJson<ScoresFile>("scores.json", bust),
      fetchOptional<StatsFile>("stats.json", { updatedAt: "", topScorers: [], topAssists: [], topCards: [] }, bust),
      fetchOptional<InjuriesFile>("injuries.json", { updatedAt: "", items: [] }, bust),
      fetchOptional<ForecastsFile>("forecasts.json", { updatedAt: "", items: [] }, bust),
    ]);
  return {
    roster, matches, predictions, standings, scores, stats, injuries, forecasts,
    teamById: new Map(roster.teams.map((t) => [t.id, t])),
    playerById: new Map(roster.players.map((p) => [p.id, p])),
    matchById: new Map(matches.matches.map((m) => [m.id, m])),
    participantById: new Map(predictions.participants.map((p) => [p.id, p])),
    injuryByPlayerId: new Map(injuries.items.filter((i) => i.playerId).map((i) => [i.playerId as string, i])),
    forecastByMatchId: new Map(forecasts.items.map((f) => [f.matchId, f])),
  };
}

const hasLive = (d: BarnitoData) =>
  d.matches.matches.some((m) => m.status === "LIVE" || m.status === "HT");

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const run = async (bust: number) => {
      try {
        const data = await loadAll(bust);
        if (cancelled) return;
        setState({ data, loading: false, error: null });
        // While a match is live, re-poll every 45s to pick up fresh deploys.
        window.clearTimeout(timer);
        if (hasLive(data)) timer = window.setTimeout(() => run(Date.now()), 45_000);
      } catch (e) {
        if (cancelled) return;
        setState((s) => (s.data ? s : { data: null, loading: false, error: (e as Error).message }));
      }
    };

    run(Math.floor(Date.now() / (5 * 60 * 1000)));
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

/** Access loaded data. Throws if used before data is ready — guard with the loading screen in App. */
export function useBarnito(): BarnitoData {
  const { data } = useContext(Ctx);
  if (!data) throw new Error("Barnito data not loaded");
  return data;
}

export function useDataState(): State {
  return useContext(Ctx);
}

/** Common derived helpers shared across pages. */
export function useHelpers() {
  const d = useBarnito();
  return useMemo(() => {
    const teamName = (id: string) => d.teamById.get(id)?.name ?? id;
    const teamGroup = (id: string) => d.teamById.get(id)?.group ?? "?";
    const playerName = (id: string) => d.playerById.get(id)?.name ?? id;
    const participantName = (id: string) => d.participantById.get(id)?.name ?? id;
    return { teamName, teamGroup, playerName, participantName };
  }, [d]);
}
