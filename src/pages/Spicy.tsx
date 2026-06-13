import { Flame } from "lucide-react";
import { useBarnito, useHelpers } from "../data/store";
import { useMatchModal } from "../components/MatchModal";
import { SectionTitle, Crest } from "../components/bits";
import { formatFull, relativeKickoff } from "../lib/format";

function chilis(score: number, max: number): number {
  if (max <= 0) return 1;
  return Math.max(1, Math.round((score / max) * 5));
}

export default function Spicy() {
  const { scores, matchById, forecastByMatchId } = useBarnito();
  const { teamName } = useHelpers();
  const { open } = useMatchModal();
  const max = scores.spiciness[0]?.score ?? 0;

  return (
    <div className="space-y-4">
      <SectionTitle icon={<Flame size={18} className="text-spice-400" />} hint="upcoming only">
        Spicy games
      </SectionTitle>
      <p className="-mt-2 text-sm text-pitch-400">
        Upcoming matches ranked by how much they could shake up the leaderboard — based on how
        differently everyone predicted them. Tune in to the top ones for the biggest swings.
      </p>

      {scores.spiciness.length === 0 ? (
        <p className="card p-6 text-center text-pitch-400">
          No upcoming games to rank — check back when fixtures are ahead.
        </p>
      ) : (
        <div className="space-y-2">
          {scores.spiciness.map((s, i) => {
            const m = matchById.get(s.matchId);
            if (!m) return null;
            const heat = chilis(s.score, max);
            const fc = forecastByMatchId.get(s.matchId);
            return (
              <button
                key={s.matchId}
                onClick={() => open(s.matchId)}
                className="card card-hover flex w-full items-center gap-3 p-3 text-left hover:border-spice-500/40"
              >
                <span className="w-5 shrink-0 text-center font-display text-lg font-bold text-pitch-600">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
                    <Crest teamId={m.homeTeamId} size={18} />
                    <span className="truncate">{teamName(m.homeTeamId)}</span>
                    <span className="text-pitch-600">v</span>
                    <Crest teamId={m.awayTeamId} size={18} />
                    <span className="truncate">{teamName(m.awayTeamId)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-pitch-400">
                    Grp {m.group} · {formatFull(m.kickoff)} · {relativeKickoff(m.kickoff)}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-spice-400">
                    <span>
                      up to <span className="font-bold">{s.maxSwing} pts</span> on the line
                    </span>
                    {fc?.winnerName && (
                      <span className="text-pitch-500">
                        · form book: {fc.winnerName} {Math.max(fc.percent.home, fc.percent.away)}%
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="flex gap-0.5 text-sm leading-none">
                    {Array.from({ length: heat }).map((_, k) => (
                      <Flame key={k} size={14} className="fill-spice-500 text-spice-500" />
                    ))}
                  </div>
                  <div className="mt-1 text-[10px] text-pitch-500">heat {s.score}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
