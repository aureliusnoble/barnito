import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useBarnito } from "../data/store";
import MatchCard from "../components/MatchCard";
import { SectionTitle } from "../components/bits";
import { sameUtcDay, formatDay } from "../lib/format";
import type { Match } from "@shared/types";

export default function Today() {
  const { matches, scores } = useBarnito();
  const now = new Date();

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
          className="card flex items-center justify-between gap-3 bg-gradient-to-r from-pitch-800/70 to-pitch-900/70 p-3"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            <div>
              <div className="text-xs text-pitch-400">Current leader</div>
              <div className="font-display text-lg font-bold">{leader.name}</div>
            </div>
          </div>
          <div className="text-right">
            <div className="font-display text-xl font-extrabold text-pitch-100">{leader.total}</div>
            <div className="text-[10px] text-pitch-400">points · tap for table</div>
          </div>
        </Link>
      )}

      {live.length > 0 && (
        <section>
          <SectionTitle hint="tap a game for predictions">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> Live now
            </span>
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
          <SectionTitle hint={formatDay(now.toISOString())}>Today's games</SectionTitle>
          <div className="space-y-2">
            {todays.map((m) => (
              <MatchCard key={m.id} match={m} />
            ))}
          </div>
        </section>
      ) : (
        nextDay.length > 0 && (
          <section>
            <SectionTitle hint={nextDayLabel}>Next up</SectionTitle>
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
