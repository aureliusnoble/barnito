import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Trophy, Radio, CalendarDays, ChevronRight, Goal, Flame } from "lucide-react";
import { useBarnito, useHelpers } from "../data/store";
import MatchCard from "../components/MatchCard";
import { SectionTitle, Crest } from "../components/bits";
import { sameUtcDay, formatDay } from "../lib/format";
import type { Match } from "@shared/types";

export default function Today() {
  const { matches, scores, stats, matchById } = useBarnito();
  const { teamName } = useHelpers();
  const now = new Date();
  const topScorer = stats.topScorers[0];
  const horizon = Date.now() + 7 * 24 * 60 * 60 * 1000;
  const spicy = scores.spiciness.find((s) => Date.parse(s.kickoff) <= horizon) ?? scores.spiciness[0];
  const spicyMatch = spicy && matchById.get(spicy.matchId);

  const { live, todays, nextDayLabel, nextDay } = useMemo(() => {
    const all = [...matches.matches].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    const live = all.filter((m) => m.status === "LIVE" || m.status === "HT");
    const todays = all.filter(
      (m) => m.status !== "LIVE" && m.status !== "HT" && sameUtcDay(new Date(m.kickoff), now),
    );
    // fallback: the next day that has upcoming matches
    let nextDay: Match[] = [];
    let nextDayLabel = "";
    if (todays.length === 0) {
      const upcoming = all.filter((m) => m.status === "SCHEDULED");
      if (upcoming.length) {
        const firstDate = upcoming[0].kickoff;
        nextDayLabel = formatDay(firstDate);
        nextDay = upcoming.filter((m) => sameUtcDay(new Date(m.kickoff), new Date(firstDate)));
      }
    }
    return { live, todays, nextDay, nextDayLabel };
  }, [matches, now]);

  const leader = scores.leaderboard[0];

  return (
    <div className="space-y-6">
      {leader && (
        <Link
          to="/leaderboard"
          className="card card-hover flex items-center justify-between gap-3 bg-gradient-to-br from-accent-500/15 via-pitch-900/60 to-pitch-900/60 p-3.5 ring-1 ring-accent-500/15"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent-500/15 text-accent-300 ring-1 ring-accent-500/25">
              <Trophy size={20} />
            </span>
            <div>
              <div className="text-[11px] uppercase tracking-wide text-pitch-400">Current leader</div>
              <div className="font-display text-lg font-bold text-white">{leader.name}</div>
            </div>
          </div>
          <div className="flex items-center gap-1 text-right">
            <div>
              <div className="font-display text-xl font-extrabold text-white">{leader.total}</div>
              <div className="text-[10px] text-pitch-400">points</div>
            </div>
            <ChevronRight size={18} className="text-pitch-500" />
          </div>
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Link to="/scorers" className="card card-hover flex flex-col gap-1 p-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-pitch-400">
            <Goal size={13} className="text-accent-400" /> Golden Boot
          </span>
          {topScorer ? (
            <>
              <span className="truncate font-display font-bold text-white">{topScorer.name}</span>
              <span className="text-xs text-pitch-400">
                {topScorer.value} {topScorer.value === 1 ? "goal" : "goals"}
                {topScorer.teamName ? ` · ${topScorer.teamName}` : ""}
              </span>
            </>
          ) : (
            <span className="text-sm text-pitch-500">No goals yet</span>
          )}
        </Link>
        <Link to="/spicy" className="card card-hover flex flex-col gap-1 p-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-pitch-400">
            <Flame size={13} className="text-spice-400" /> Spiciest soon
          </span>
          {spicyMatch ? (
            <>
              <span className="flex items-center gap-1 font-display font-bold text-white">
                <Crest teamId={spicyMatch.homeTeamId} size={16} />
                <span className="truncate text-sm">{teamName(spicyMatch.homeTeamId)}</span>
                <span className="text-pitch-600">v</span>
                <Crest teamId={spicyMatch.awayTeamId} size={16} />
                <span className="truncate text-sm">{teamName(spicyMatch.awayTeamId)}</span>
              </span>
              <span className="text-xs text-spice-400">spice {spicy!.score.toFixed(1)}</span>
            </>
          ) : (
            <span className="text-sm text-pitch-500">Nothing upcoming</span>
          )}
        </Link>
      </div>

      {live.length > 0 && (
        <section>
          <SectionTitle
            icon={<Radio size={18} className="animate-pulse text-red-500" />}
            hint="tap a game for predictions"
          >
            Live now
          </SectionTitle>
          <div className="space-y-2">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      )}

      {todays.length > 0 ? (
        <section>
          <SectionTitle icon={<CalendarDays size={18} className="text-accent-400" />} hint={formatDay(now.toISOString())}>
            Today's games
          </SectionTitle>
          <div className="space-y-2">
            {todays.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      ) : (
        nextDay.length > 0 && (
          <section>
            <SectionTitle icon={<CalendarDays size={18} className="text-pitch-400" />} hint={nextDayLabel}>
              Next up
            </SectionTitle>
            <p className="mb-2 text-xs text-pitch-400">No games today — here's the next match day.</p>
            <div className="space-y-2">
              {nextDay.map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
          </section>
        )
      )}

      {live.length === 0 && todays.length === 0 && nextDay.length === 0 && (
        <div className="card p-8 text-center text-pitch-300">
          <div className="mb-2 text-4xl">🏝️</div>
          No upcoming games — the group stage is done!
        </div>
      )}
    </div>
  );
}
