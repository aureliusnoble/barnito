import { Flame, ChevronRight } from "lucide-react";
import { useBarnito, useHelpers } from "../data/store";
import { useMatchModal } from "../components/MatchModal";
import { SectionTitle, Crest, SpiceRating, HotTakeBadge } from "../components/bits";
import { formatDay, formatTime, relativeKickoff } from "../lib/format";
import type { SpicyMatch } from "@shared/types";

function HeatBar({ score, max }: { score: number; max: number }) {
  const pct = max > 0 ? Math.max(8, Math.round((score / max) * 100)) : 8;
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-pitch-800">
      <div
        className="h-full origin-left animate-bar-grow rounded-full bg-gradient-to-r from-amber-400 via-spice-500 to-red-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function Spicy() {
  const { scores, matchById } = useBarnito();
  const { teamName } = useHelpers();
  const { open } = useMatchModal();

  // Focus on the near future — the point is to tell people what to tune into soon.
  const horizon = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const soon = scores.spiciness.filter((s) => Date.parse(s.kickoff) <= horizon);
  const ranked = soon.length > 0 ? soon : scores.spiciness;

  const max = ranked[0]?.score ?? 0;
  const [hero, ...rest] = ranked;
  const heroMatch = hero && matchById.get(hero.matchId);

  return (
    <div className="space-y-5">
      <div>
        <SectionTitle icon={<Flame size={18} className="text-spice-400" />} hint={soon.length > 0 ? "next 7 days" : "upcoming"}>
          Spicy games
        </SectionTitle>
        <p className="-mt-2 text-sm text-pitch-400">
          The games worth tuning into soon — ranked by how much they could shake up the table.
          The more everyone disagreed, the bigger the potential swing. 🌶️
        </p>
      </div>

      {ranked.length === 0 ? (
        <p className="card p-6 text-center text-pitch-400">
          No upcoming games to rank yet — check back when fixtures are ahead.
        </p>
      ) : (
        <>
          {hero && heroMatch && (
            <button
              onClick={() => open(hero.matchId)}
              className="card card-hover relative w-full overflow-hidden p-4 text-left ring-1 ring-spice-500/25"
            >
              <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-spice-500/10 blur-2xl" />
              <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-spice-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-spice-300">
                <Flame size={13} className="fill-spice-500 text-spice-500" /> Don't miss
              </div>
              <div className="flex items-center justify-center gap-4">
                <TeamMini teamId={heroMatch.homeTeamId} name={teamName(heroMatch.homeTeamId)} />
                <span className="font-display text-sm text-pitch-500">vs</span>
                <TeamMini teamId={heroMatch.awayTeamId} name={teamName(heroMatch.awayTeamId)} />
              </div>
              <div className="mt-3 text-center text-xs text-pitch-400">
                {formatDay(heroMatch.kickoff)} · {formatTime(heroMatch.kickoff)} ·{" "}
                <span className="text-pitch-300">{relativeKickoff(heroMatch.kickoff)}</span>
              </div>
              <div className="mx-auto mt-3 max-w-xs">
                <HeatBar score={hero.score} max={max} />
                <div className="mt-1.5 flex items-center justify-center gap-1.5 text-sm font-semibold text-spice-300">
                  <span className="text-pitch-400">spice rating</span> <SpiceRating score={hero.score} max={max} size={16} />
                </div>
              </div>
              <div className="mt-2 flex justify-center">
                <HotTakeBadge matchId={hero.matchId} />
              </div>
            </button>
          )}

          {rest.length > 0 && (
            <div>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-pitch-500">
                Also heating up
              </h3>
              <div className="space-y-2">
                {rest.map((s, i) => (
                  <SpicyRow key={s.matchId} s={s} rank={i + 2} max={max} onOpen={() => open(s.matchId)} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TeamMini({ teamId, name }: { teamId: string; name: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <Crest teamId={teamId} size={40} />
      <span className="max-w-[7rem] truncate text-sm font-semibold text-white">{name}</span>
    </div>
  );
}

function SpicyRow({
  s,
  rank,
  max,
  onOpen,
}: {
  s: SpicyMatch;
  rank: number;
  max: number;
  onOpen: () => void;
}) {
  const { matchById } = useBarnito();
  const { teamName } = useHelpers();
  const m = matchById.get(s.matchId);
  if (!m) return null;
  return (
    <button onClick={onOpen} className="card card-hover flex w-full items-center gap-3 p-3 text-left">
      <span className="w-4 shrink-0 text-center font-display text-sm font-bold text-pitch-600">{rank}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-white">
          <Crest teamId={m.homeTeamId} size={18} />
          <span className="truncate">{teamName(m.homeTeamId)}</span>
          <span className="text-pitch-600">v</span>
          <Crest teamId={m.awayTeamId} size={18} />
          <span className="truncate">{teamName(m.awayTeamId)}</span>
        </div>
        <div className="mt-1 text-[11px] text-pitch-400">
          {formatDay(m.kickoff)} · {formatTime(m.kickoff)} · {relativeKickoff(m.kickoff)}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <div className="w-24"><HeatBar score={s.score} max={max} /></div>
          <SpiceRating score={s.score} max={max} size={12} />
          <HotTakeBadge matchId={s.matchId} />
        </div>
      </div>
      <ChevronRight size={16} className="shrink-0 text-pitch-600" />
    </button>
  );
}
