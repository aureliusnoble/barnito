import type { Match } from "@shared/types";
import { useHelpers } from "../data/store";
import { Flag, StatusBadge } from "./bits";
import { useMatchModal } from "./MatchModal";
import { formatTime } from "../lib/format";

export default function MatchCard({ match, showGroup = true }: { match: Match; showGroup?: boolean }) {
  const { teamName } = useHelpers();
  const { open } = useMatchModal();
  const hasScore = match.homeGoals != null && match.awayGoals != null;
  const live = match.status === "LIVE" || match.status === "HT";

  return (
    <button
      onClick={() => open(match.id)}
      className={`card flex w-full items-center gap-3 p-3 text-left transition hover:border-pitch-600/70 hover:bg-pitch-900/80 ${
        live ? "ring-1 ring-red-500/40" : ""
      }`}
    >
      <div className="flex w-10 flex-col items-center gap-0.5">
        <StatusBadge match={match} />
        {showGroup && <span className="text-[10px] text-pitch-500">{match.group}</span>}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <Row teamId={match.homeTeamId} name={teamName(match.homeTeamId)} goals={match.homeGoals} winner={hasScore && match.homeGoals! > match.awayGoals!} />
        <Row teamId={match.awayTeamId} name={teamName(match.awayTeamId)} goals={match.awayGoals} winner={hasScore && match.awayGoals! > match.homeGoals!} />
      </div>

      <div className="w-12 shrink-0 text-right">
        {hasScore ? (
          <span className="text-[10px] text-pitch-500">{match.status === "FINISHED" ? "FT" : `${match.elapsed ?? ""}'`}</span>
        ) : (
          <span className="text-sm font-semibold tabular-nums text-pitch-200">
            {formatTime(match.kickoff)}
          </span>
        )}
      </div>
    </button>
  );
}

function Row({
  teamId,
  name,
  goals,
  winner,
}: {
  teamId: string;
  name: string;
  goals: number | null;
  winner: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-2 ${winner ? "font-bold" : ""}`}>
      <span className="flex min-w-0 items-center gap-1.5">
        <Flag teamId={teamId} className="text-base leading-none" />
        <span className="truncate text-sm">{name}</span>
      </span>
      {goals != null && (
        <span className="font-display text-base font-bold tabular-nums">{goals}</span>
      )}
    </div>
  );
}
