import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Trophy, ChevronRight, Goal, Flame, Radio, History } from "lucide-react";
import { useBarnito, useHelpers } from "../data/store";
import MatchCard from "../components/MatchCard";
import { SectionTitle, Crest, SpiceRating } from "../components/bits";
import { ukSlateCutoffMs } from "../lib/format";

export default function Today() {
  const { matches, scores, stats, matchById } = useBarnito();
  const [tab, setTab] = useState<"today" | "recent">("today");

  const now = Date.now();
  const cutoff = ukSlateCutoffMs(now);

  const todays = useMemo(
    () =>
      matches.matches
        .filter((m) => m.status !== "FINISHED" && Date.parse(m.kickoff) < cutoff && Date.parse(m.kickoff) > now - 6 * 3600_000)
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    [matches, cutoff, now],
  );
  const recent = useMemo(
    () =>
      matches.matches
        .filter((m) => Date.parse(m.kickoff) >= now - 18 * 3600_000 && Date.parse(m.kickoff) <= now)
        .sort((a, b) => b.kickoff.localeCompare(a.kickoff)),
    [matches, now],
  );

  const leader = scores.leaderboard[0];
  const topScorer = stats.topScorers[0];
  const spicy = scores.spiciness.find((s) => Date.parse(s.kickoff) <= now + 7 * 86400_000) ?? scores.spiciness[0];
  const spicyMatch = spicy && matchById.get(spicy.matchId);
  const spiceMax = useMemo(() => Math.max(0, ...scores.spiciness.map((s) => s.score)), [scores]);
  const { teamName } = useHelpers();

  return (
    <div className="space-y-5">
      {leader && (
        <Link to="/leaderboard" className="card card-hover flex items-center justify-between gap-3 bg-gradient-to-br from-accent-500/15 via-pitch-900/60 to-pitch-900/60 p-3.5 ring-1 ring-accent-500/15">
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
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-pitch-400"><Goal size={13} className="text-accent-400" /> Golden Boot</span>
          {topScorer ? (
            <>
              <span className="truncate font-display font-bold text-white">{topScorer.name}</span>
              <span className="text-xs text-pitch-400">{topScorer.value} {topScorer.value === 1 ? "goal" : "goals"}{topScorer.teamName ? ` · ${topScorer.teamName}` : ""}</span>
            </>
          ) : <span className="text-sm text-pitch-500">No goals yet</span>}
        </Link>
        <Link to="/spicy" className="card card-hover flex flex-col gap-1 p-3">
          <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-pitch-400"><Flame size={13} className="text-spice-400" /> Spiciest soon</span>
          {spicyMatch ? (
            <>
              <span className="flex items-center gap-1 font-display font-bold text-white">
                <Crest teamId={spicyMatch.homeTeamId} size={16} /><span className="truncate text-sm">{teamName(spicyMatch.homeTeamId)}</span>
                <span className="text-pitch-600">v</span>
                <Crest teamId={spicyMatch.awayTeamId} size={16} /><span className="truncate text-sm">{teamName(spicyMatch.awayTeamId)}</span>
              </span>
              <SpiceRating score={spicy!.score} max={spiceMax} size={13} />
            </>
          ) : <span className="text-sm text-pitch-500">Nothing upcoming</span>}
        </Link>
      </div>

      {/* today | recent */}
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-pitch-900/70 p-1 ring-1 ring-white/[0.06]">
        {([["today", "Today", Radio], ["recent", "Recent", History]] as const).map(([t, label, Icon]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-semibold transition ${tab === t ? "bg-accent-500 text-pitch-950" : "text-pitch-300 hover:text-white"}`}>
            <Icon size={14} strokeWidth={2.5} />{label}
          </button>
        ))}
      </div>

      {tab === "today" ? (
        <section>
          <SectionTitle hint="upcoming & live">Today's games</SectionTitle>
          {todays.length === 0 ? (
            <div className="card p-8 text-center text-pitch-300">
              <div className="mb-2 text-3xl">🌙</div>No more games today — check "Recent" for results.
            </div>
          ) : (
            <div className="space-y-2">{todays.map((m) => <MatchCard key={m.id} match={m} />)}</div>
          )}
        </section>
      ) : (
        <section>
          <SectionTitle icon={<History size={18} className="text-pitch-300" />} hint="last 18 hours">Recent matches</SectionTitle>
          {recent.length === 0 ? (
            <p className="card p-6 text-center text-pitch-400">No matches in the last 18 hours.</p>
          ) : (
            <div className="space-y-2">{recent.map((m) => <MatchCard key={m.id} match={m} />)}</div>
          )}
        </section>
      )}
    </div>
  );
}
