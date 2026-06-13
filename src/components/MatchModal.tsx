import { createContext, useContext, useState, type ReactNode } from "react";
import { useBarnito, useHelpers } from "../data/store";
import { Flag, StatusBadge, PointsPill, GroupPill } from "./bits";
import { formatFull } from "../lib/format";
import type { Match } from "@shared/types";

interface ModalCtx {
  open: (matchId: string) => void;
}
const Ctx = createContext<ModalCtx>({ open: () => {} });
export const useMatchModal = () => useContext(Ctx);

export function MatchModalProvider({ children }: { children: ReactNode }) {
  const [matchId, setMatchId] = useState<string | null>(null);
  return (
    <Ctx.Provider value={{ open: setMatchId }}>
      {children}
      {matchId && <MatchDetail matchId={matchId} onClose={() => setMatchId(null)} />}
    </Ctx.Provider>
  );
}

function ScoreOrTime({ match }: { match: Match }) {
  if (match.homeGoals != null && match.awayGoals != null) {
    return (
      <span className="font-display text-3xl font-extrabold tabular-nums">
        {match.homeGoals}
        <span className="px-1 text-pitch-500">–</span>
        {match.awayGoals}
      </span>
    );
  }
  return <span className="text-pitch-400">vs</span>;
}

function MatchDetail({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const { matchById, scores } = useBarnito();
  const { teamName, playerName } = useHelpers();
  const match = matchById.get(matchId);
  if (!match) return null;
  const perMatch = scores.perMatch.find((p) => p.matchId === matchId);
  const homeGoals = match.goals.filter((g) => g.teamId === match.homeTeamId);
  const awayGoals = match.goals.filter((g) => g.teamId === match.awayTeamId);

  const predicted = perMatch?.predictions ?? [];
  const madepreds = predicted.filter((p) => p.predHome != null);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="card max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-b-none rounded-t-3xl sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="sticky top-0 z-10 border-b border-pitch-800/60 bg-pitch-900/95 p-4 backdrop-blur">
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GroupPill group={match.group} />
              <span className="text-xs text-pitch-400">Matchday {match.matchday}</span>
            </div>
            <button
              onClick={onClose}
              className="rounded-full bg-pitch-800 px-2 py-0.5 text-sm text-pitch-300 hover:text-white"
            >
              ✕
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex flex-1 flex-col items-center gap-1">
              <Flag teamId={match.homeTeamId} className="text-3xl" />
              <span className="text-center text-sm font-semibold">{teamName(match.homeTeamId)}</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <ScoreOrTime match={match} />
              <StatusBadge match={match} />
            </div>
            <div className="flex flex-1 flex-col items-center gap-1">
              <Flag teamId={match.awayTeamId} className="text-3xl" />
              <span className="text-center text-sm font-semibold">{teamName(match.awayTeamId)}</span>
            </div>
          </div>
          <div className="mt-2 text-center text-xs text-pitch-400">
            {formatFull(match.kickoff)}
            {match.ground ? ` · ${match.ground}` : ""}
          </div>
        </div>

        {/* goal scorers */}
        {(homeGoals.length > 0 || awayGoals.length > 0) && (
          <div className="grid grid-cols-2 gap-2 border-b border-pitch-800/60 p-4 text-xs">
            <ul className="space-y-1">
              {homeGoals.map((g, i) => (
                <li key={i} className="text-pitch-200">
                  ⚽ {playerName(g.playerId ?? "") || g.playerName}
                  {g.minute != null && <span className="text-pitch-500"> {g.minute}'</span>}
                  {g.ownGoal && <span className="text-red-400"> (OG)</span>}
                </li>
              ))}
            </ul>
            <ul className="space-y-1 text-right">
              {awayGoals.map((g, i) => (
                <li key={i} className="text-pitch-200">
                  {g.minute != null && <span className="text-pitch-500">{g.minute}' </span>}
                  {playerName(g.playerId ?? "") || g.playerName}
                  {g.ownGoal && <span className="text-red-400"> (OG)</span>} ⚽
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* predictions */}
        <div className="p-4">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="font-display font-bold">Predictions</h3>
            <span className="text-xs text-pitch-400">
              {match.status === "SCHEDULED"
                ? "points pending"
                : match.status === "FINISHED"
                  ? "final points"
                  : "provisional *"}
            </span>
          </div>
          {madepreds.length === 0 ? (
            <p className="text-sm text-pitch-400">No predictions on record for this match.</p>
          ) : (
            <ul className="divide-y divide-pitch-800/50">
              {madepreds.map((p) => (
                <li key={p.participantId} className="flex items-center justify-between py-2">
                  <span className="flex items-center gap-2 text-sm">
                    {p.name}
                    {p.exact && <span title="Exact score">🎯</span>}
                    {!p.exact && p.outcome && match.status !== "SCHEDULED" && (
                      <span title="Correct result">✅</span>
                    )}
                  </span>
                  <span className="flex items-center gap-3">
                    <span className="font-mono text-sm tabular-nums text-pitch-200">
                      {p.predHome}–{p.predAway}
                    </span>
                    {match.status !== "SCHEDULED" && (
                      <PointsPill points={p.points} provisional={p.provisional} />
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
