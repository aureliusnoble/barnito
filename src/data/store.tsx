import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  Roster, MatchesFile, PredictionsFile, StandingsFile, ScoresFile,
  StatsFile, InjuriesFile, ForecastsFile, BracketFile,
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
  bracket: BracketFile;
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

// Data is read straight from the repo's raw URL so a cron commit is visible immediately
// (no rebuild/redeploy needed). Falls back to the copy bundled with the deploy if raw is
// unreachable. Override the source with VITE_DATA_URL at build time.
const RAW_BASE =
  import.meta.env.VITE_DATA_URL ||
  "https://raw.githubusercontent.com/aureliusnoble/barnito/main/public/data";
const BUNDLED_BASE = `${import.meta.env.BASE_URL}data`;

async function getJson<T>(file: string, bust: number, fallback?: T): Promise<T> {
  for (const base of [RAW_BASE, BUNDLED_BASE]) {
    try {
      const res = await fetch(`${base}/${file}?v=${bust}`);
      if (res.ok) return (await res.json()) as T;
    } catch {
      /* try the next source */
    }
  }
  if (fallback !== undefined) return fallback;
  throw new Error(`Failed to load ${file}`);
}

const fetchJson = <T,>(file: string, bust: number) => getJson<T>(file, bust);
const fetchOptional = <T,>(file: string, fallback: T, bust: number) => getJson<T>(file, bust, fallback);

async function loadAll(bust: number): Promise<BarnitoData> {
  const [roster, matches, predictions, standings, scores, stats, injuries, forecasts, bracket] =
    await Promise.all([
      fetchJson<Roster>("roster.json", bust),
      fetchJson<MatchesFile>("matches.json", bust),
      fetchJson<PredictionsFile>("predictions.json", bust),
      fetchJson<StandingsFile>("standings.json", bust),
      fetchJson<ScoresFile>("scores.json", bust),
      fetchOptional<StatsFile>("stats.json", { updatedAt: "", topScorers: [], topAssists: [], topCards: [] }, bust),
      fetchOptional<InjuriesFile>("injuries.json", { updatedAt: "", items: [] }, bust),
      fetchOptional<ForecastsFile>("forecasts.json", { updatedAt: "", items: [] }, bust),
      fetchOptional<BracketFile>("bracket.json", { updatedAt: "", rounds: [] }, bust),
    ]);
  return {
    roster, matches, predictions, standings, scores, stats, injuries, forecasts, bracket,
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
        // While a match is live, re-poll the raw data every 30s (cache-busted) for near-live scores.
        window.clearTimeout(timer);
        if (hasLive(data)) timer = window.setTimeout(() => run(Date.now()), 30_000);
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
