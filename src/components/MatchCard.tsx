import type { Match } from "@shared/types";
import { useHelpers } from "../data/store";
import { StatusBadge, Crest } from "./bits";
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
      className={`card card-hover flex w-full items-center gap-3 p-3 text-left ${
        live ? "ring-1 ring-red-500/30" : ""
      }`}
    >
      <div className="flex w-11 shrink-0 flex-col items-center gap-1">
        <StatusBadge match={match} />
        {showGroup && <span className="text-[10px] font-semibold text-pitch-500">Grp {match.group}</span>}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <Row
          teamId={match.homeTeamId}
          name={teamName(match.homeTeamId)}
          goals={match.homeGoals}
          winner={hasScore && match.homeGoals! > match.awayGoals!}
        />
        <Row
          teamId={match.awayTeamId}
          name={teamName(match.awayTeamId)}
          goals={match.awayGoals}
          winner={hasScore && match.awayGoals! > match.homeGoals!}
        />
      </div>

      <div className="w-12 shrink-0 text-right">
        {hasScore ? (
          <span className="text-[10px] font-medium text-pitch-500">
            {match.status === "FINISHED" ? "Full time" : "Live"}
          </span>
        ) : (
          <span className="font-display text-sm font-bold tabular-nums text-pitch-200">
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
    <div
      className={`flex items-center justify-between gap-2 ${
        winner ? "text-white" : "text-pitch-200"
      }`}
    >
      <span className="flex min-w-0 items-center gap-2">
        <Crest teamId={teamId} size={20} />
        <span className={`truncate text-sm ${winner ? "font-bold" : "font-medium"}`}>{name}</span>
      </span>
      {goals != null && (
        <span className={`font-display text-base tabular-nums ${winner ? "font-extrabold text-white" : "font-bold"}`}>
          {goals}
        </span>
      )}
    </div>
  );
}
