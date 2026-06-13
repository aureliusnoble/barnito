import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type {
  Roster, MatchesFile, PredictionsFile, StandingsFile, ScoresFile,
  Team, Player, Match, Participant,
} from "@shared/types";

export interface BarnitoData {
  roster: Roster;
  matches: MatchesFile;
  predictions: PredictionsFile;
  standings: StandingsFile;
  scores: ScoresFile;
  // lookups
  teamById: Map<string, Team>;
  playerById: Map<string, Player>;
  matchById: Map<string, Match>;
  participantById: Map<string, Participant>;
}

interface State {
  data: BarnitoData | null;
  loading: boolean;
  error: string | null;
}

const Ctx = createContext<State>({ data: null, loading: true, error: null });

async function fetchJson<T>(file: string): Promise<T> {
  const res = await fetch(`${import.meta.env.BASE_URL}data/${file}?v=${BUILD_ID}`);
  if (!res.ok) throw new Error(`Failed to load ${file}: ${res.status}`);
  return (await res.json()) as T;
}

// cache-bust per session so a fresh deploy / cron update is picked up
const BUILD_ID = Math.floor(Date.now() / (5 * 60 * 1000)); // changes every 5 min

export function DataProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ data: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [roster, matches, predictions, standings, scores] = await Promise.all([
          fetchJson<Roster>("roster.json"),
          fetchJson<MatchesFile>("matches.json"),
          fetchJson<PredictionsFile>("predictions.json"),
          fetchJson<StandingsFile>("standings.json"),
          fetchJson<ScoresFile>("scores.json"),
        ]);
        if (cancelled) return;
        const data: BarnitoData = {
          roster, matches, predictions, standings, scores,
          teamById: new Map(roster.teams.map((t) => [t.id, t])),
          playerById: new Map(roster.players.map((p) => [p.id, p])),
          matchById: new Map(matches.matches.map((m) => [m.id, m])),
          participantById: new Map(predictions.participants.map((p) => [p.id, p])),
        };
        setState({ data, loading: false, error: null });
      } catch (e) {
        if (cancelled) return;
        setState({ data: null, loading: false, error: (e as Error).message });
      }
    })();
    return () => {
      cancelled = true;
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
