import { useMemo } from "react";
import { Flame } from "lucide-react";
import { useEuro } from "../store/store";
import { spiceLevel } from "../lib/spice";
import { fmtDay, fmtTime, relKickoff } from "../lib/format";
import { EmptyState, PageHead, SpiceTag, TeamMark } from "../ui/kit";

function HeatBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.max(6, Math.round((score / max) * 100)) : 6;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]">
      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-punch-400 to-red-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

export default function Spicy() {
  const { state, nowMs, teamById, spiceOf } = useEuro();

  const ranked = useMemo(
    () =>
      state.fixtures
        .filter((f) => f.status !== "FINISHED" && f.homeTeamId && f.awayTeamId)
        .map((f) => ({ f, spice: spiceOf(f) }))
        .filter((x) => x.spice > 0.05)
        .sort((a, b) => b.spice - a.spice)
        .slice(0, 12),
    [state.fixtures, spiceOf],
  );

  const max = ranked[0]?.spice ?? 0;
  const [hero, ...rest] = ranked;

  return (
    <div className="space-y-4">
      <PageHead
        title="Spicy games"
        sub="Ranked by how hard the result could shake the leaderboard, given everyone's locked picks and tokens — scaled to the round."
      />

      {ranked.length === 0 && (
        <EmptyState emoji="🫑">
          Nothing spicy yet — heat builds once picks and tokens are locked on upcoming games.
        </EmptyState>
      )}

      {hero && (
        <div className="e-card relative overflow-hidden p-4 ring-1 ring-punch-500/25">
          <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-punch-500/10 blur-2xl" />
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-punch-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-punch-300">
            <Flame size={13} className="fill-punch-500 text-punch-500" /> Don't miss
          </div>
          <div className="flex items-center justify-center gap-4">
            <TeamMark team={teamById.get(hero.f.homeTeamId!)} size="lg" />
            <span className="font-grotesk text-sm text-ink-500">vs</span>
            <TeamMark team={teamById.get(hero.f.awayTeamId!)} size="lg" />
          </div>
          <div className="mt-3 text-center text-xs text-ink-400">
            {fmtDay(hero.f.kickoff)} · {fmtTime(hero.f.kickoff)} · <span className="text-ink-200">{relKickoff(hero.f.kickoff, nowMs)}</span>
          </div>
          <div className="mx-auto mt-3 max-w-xs">
            <HeatBar score={hero.spice} max={max} />
            <div className="mt-1.5 flex items-center justify-center gap-1.5 text-sm font-semibold text-punch-300">
              <SpiceTag level={spiceLevel(hero.spice)} /> spice {hero.spice.toFixed(1)}
            </div>
          </div>
        </div>
      )}

      {rest.length > 0 && (
        <div className="space-y-2">
          {rest.map(({ f, spice }, i) => (
            <div key={f.id} className="e-card flex items-center gap-3 p-3">
              <span className="w-4 shrink-0 text-center font-grotesk text-sm font-bold text-ink-600">{i + 2}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 text-sm">
                  <TeamMark team={teamById.get(f.homeTeamId!)} size="sm" />
                  <span className="text-ink-600">v</span>
                  <TeamMark team={teamById.get(f.awayTeamId!)} size="sm" />
                </div>
                <div className="mt-1 text-[11px] text-ink-400">
                  {fmtDay(f.kickoff)} · {fmtTime(f.kickoff)} · {relKickoff(f.kickoff, nowMs)}
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="w-24">
                    <HeatBar score={spice} max={max} />
                  </div>
                  <span className="e-num text-[11px] text-punch-300">spice {spice.toFixed(1)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
