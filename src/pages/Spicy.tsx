import { useBarnito, useHelpers } from "../data/store";
import { useMatchModal } from "../components/MatchModal";
import { SectionTitle, Flag } from "../components/bits";
import { formatFull, relativeKickoff } from "../lib/format";

// map a spiciness score to a number of chili peppers (relative heat)
function chilis(score: number, max: number): string {
  if (max <= 0) return "🌶️";
  const n = Math.max(1, Math.round((score / max) * 5));
  return "🌶️".repeat(n);
}

export default function Spicy() {
  const { scores, matchById } = useBarnito();
  const { teamName } = useHelpers();
  const { open } = useMatchModal();
  const max = scores.spiciness[0]?.score ?? 0;

  return (
    <div className="space-y-4">
      <SectionTitle hint="upcoming only">Spicy games 🌶️</SectionTitle>
      <p className="-mt-2 text-xs text-pitch-400">
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
            return (
              <button
                key={s.matchId}
                onClick={() => open(s.matchId)}
                className="card flex w-full items-center gap-3 p-3 text-left transition hover:border-spice-500/50 hover:bg-pitch-900/80"
              >
                <span className="w-6 shrink-0 text-center font-display text-lg font-bold text-pitch-500">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    <Flag teamId={m.homeTeamId} />
                    <span className="truncate">{teamName(m.homeTeamId)}</span>
                    <span className="text-pitch-500">v</span>
                    <Flag teamId={m.awayTeamId} />
                    <span className="truncate">{teamName(m.awayTeamId)}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-pitch-400">
                    Grp {m.group} · {formatFull(m.kickoff)} · {relativeKickoff(m.kickoff)}
                  </div>
                  <div className="mt-1 text-[11px] text-spice-400">
                    up to <span className="font-bold">{s.maxSwing} pts</span> on the line
                    {s.topOutcome && (
                      <span className="text-pitch-500">
                        {" "}
                        (biggest split at {s.topOutcome.home}–{s.topOutcome.away})
                      </span>
                    )}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-lg leading-none">{chilis(s.score, max)}</div>
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
