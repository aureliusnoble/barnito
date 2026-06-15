import { createContext, useContext, useState, type ReactNode } from "react";
import { X, MapPin, ArrowLeftRight, Star, Sparkles, Swords, ChevronDown, ChevronRight, Target } from "lucide-react";
import { useBarnito, useHelpers } from "../data/store";
import { usePlayerModal } from "./PlayerModal";
import { StatusBadge, PointsPill, GroupPill, Crest, PosBadge } from "./bits";
import { Avatar } from "./visuals";
import { PitchMarkings, lastName } from "./Pitch";
import { formatFull, ordinal } from "../lib/format";
import { WC_HISTORY } from "../data/wcHistory";
import type { Lineup, LineupPlayer, Match, MatchEvent, MatchPredictionResult, PlayerRating, TeamStat } from "@shared/types";

function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between text-xs"><span className="text-pitch-400">{label}</span><span className="font-semibold text-pitch-100">{children}</span></div>;
}

function TeamInfo({ match }: { match: Match }) {
  const { teamById, standings } = useBarnito();
  const rows = standings.groups.find((g) => g.group === match.group)?.rows ?? [];
  const pos = (id: string) => rows.find((r) => r.teamId === id)?.pos;
  const coach = new Map((match.lineups ?? []).map((l) => [l.teamId, l.coach]));

  return (
    <section>
      <h3 className="mb-2 font-display font-bold text-white">Team info</h3>
      <div className="grid grid-cols-2 gap-3">
        {[match.homeTeamId, match.awayTeamId].map((id) => {
          const t = teamById.get(id);
          if (!t) return <div key={id} />;
          const p = pos(id);
          const wc = WC_HISTORY[id];
          return (
            <div key={id} className="card space-y-1.5 p-3">
              <div className="flex items-center gap-1.5"><Crest teamId={id} size={18} /><span className="truncate text-sm font-semibold text-white">{t.name}</span></div>
              <InfoRow label="FIFA rank">{t.fifaRank ? `#${t.fifaRank}` : "—"}</InfoRow>
              <InfoRow label="Group">{p ? `${ordinal(p)} · ${match.group}` : (match.group as string) !== "?" ? `Group ${match.group}` : "—"}</InfoRow>
              {coach.get(id) && <InfoRow label="Coach">{coach.get(id)}</InfoRow>}
              {wc && (
                <div className="space-y-0.5 border-t border-white/[0.06] pt-1.5 text-[11px] leading-tight">
                  <div className="text-pitch-500">World Cup best <span className="block text-pitch-200">{wc.best}</span></div>
                  <div className="text-pitch-500">Last appearance <span className="block text-pitch-200">{wc.recent}</span></div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function CompTag({ league }: { league: string }) {
  const friendly = /friendl/i.test(league || "");
  return (
    <span
      title={league}
      className={`chip max-w-[6.5rem] shrink-0 truncate text-[9px] ${
        friendly ? "bg-pitch-800 text-pitch-400" : "bg-accent-500/15 text-accent-300"
      }`}
    >
      {friendly ? "Friendly" : league}
    </span>
  );
}

function H2H({ match }: { match: Match }) {
  if (!match.h2h || match.h2h.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 font-display font-bold text-white"><Swords size={15} className="text-pitch-400" /> Head-to-head</h3>
      <ul className="space-y-1.5">
        {match.h2h.map((h, i) => (
          <li key={i} className="flex items-center gap-2 text-[13px]">
            <span className="w-14 shrink-0 text-[11px] text-pitch-500">{h.date.slice(0, 7)}</span>
            <span className="min-w-0 flex-1 truncate text-pitch-200">{h.homeName} <span className="font-bold tabular-nums text-white">{h.homeGoals}–{h.awayGoals}</span> {h.awayName}</span>
            <CompTag league={h.league} />
          </li>
        ))}
      </ul>
    </section>
  );
}

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
      <span className="font-display text-4xl font-extrabold tabular-nums text-white">
        {match.homeGoals}
        <span className="px-1.5 text-pitch-600">–</span>
        {match.awayGoals}
      </span>
    );
  }
  return <span className="font-display text-2xl text-pitch-500">vs</span>;
}

type TabKey = "predictions" | "info" | "match";

function MatchDetail({ matchId, onClose }: { matchId: string; onClose: () => void }) {
  const { matchById, scores } = useBarnito();
  const { teamName } = useHelpers();
  const match = matchById.get(matchId);
  const [tab, setTab] = useState<TabKey>("predictions");
  if (!match) return null;
  const perMatch = scores.perMatch.find((p) => p.matchId === matchId);
  const predicted = (perMatch?.predictions ?? []).filter((p) => p.predHome != null);
  const events = (match.events ?? []).slice().sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  const venue = match.venue;

  const hasRatings = (match.ratings ?? []).some((r) => r.rating != null);
  const hasStats = !!match.stats && match.stats.length === 2;
  const hasLineups = !!match.lineups && match.lineups.length > 0;
  const hasMatchDetail = events.length > 0 || hasStats || hasRatings;

  // Predictions stay the focus (default tab); everything else lives behind tabs to keep it clean.
  const tabs: { key: TabKey; label: string }[] = [
    { key: "predictions", label: "Predictions" },
    { key: "info", label: "Team info" },
  ];
  if (hasMatchDetail) tabs.push({ key: "match", label: "Match" });
  const active = tabs.some((t) => t.key === tab) ? tab : "predictions";

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in sm:items-center"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-b-none rounded-t-4xl border-white/10 sm:rounded-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header — summary only */}
        <div className="sticky top-0 z-10 border-b border-white/[0.06] bg-pitch-900/90 p-4 backdrop-blur-xl">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GroupPill group={match.group} />
              <span className="text-xs text-pitch-400">Matchday {match.matchday}</span>
            </div>
            <button
              onClick={onClose}
              className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-pitch-300 transition hover:bg-white/10 hover:text-white"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center justify-between gap-2">
            <TeamHead teamId={match.homeTeamId} name={teamName(match.homeTeamId)} />
            <div className="flex flex-col items-center gap-1.5">
              <ScoreOrTime match={match} />
              <StatusBadge match={match} />
            </div>
            <TeamHead teamId={match.awayTeamId} name={teamName(match.awayTeamId)} />
          </div>
          <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-pitch-400">
            <span>{formatFull(match.kickoff)}</span>
            {(venue?.name || match.ground) && (
              <>
                <span className="text-pitch-600">·</span>
                <MapPin size={12} />
                <span className="truncate">
                  {venue?.name ?? match.ground}
                  {venue?.city ? `, ${venue.city}` : ""}
                </span>
              </>
            )}
          </div>
        </div>

        <div className="p-4">
          {/* tabs */}
          <div
            className="mb-4 grid gap-1 rounded-xl bg-pitch-900/70 p-1 ring-1 ring-white/[0.06]"
            style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }}
          >
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`rounded-lg py-1.5 text-sm font-semibold transition ${
                  active === t.key ? "bg-accent-500 text-pitch-950" : "text-pitch-300 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          {active === "predictions" && (
            <div className="space-y-5">
              {match.status === "SCHEDULED" && (
                <PredictionSplit
                  preds={predicted}
                  homeName={teamName(match.homeTeamId)}
                  awayName={teamName(match.awayTeamId)}
                />
              )}
              <Predictions match={match} predicted={predicted} />
              <PickedScorers match={match} />
            </div>
          )}

          {active === "info" && (
            <div className="space-y-5">
              <TeamInfo match={match} />
              <H2H match={match} />
              {hasLineups ? (
                <Lineups match={match} />
              ) : (
                <section>
                  <h3 className="mb-2 font-display font-bold text-white">Lineups</h3>
                  <p className="card p-4 text-center text-sm text-pitch-400">
                    {match.status === "SCHEDULED" ? "Lineup available shortly before match" : "Lineups not available for this match"}
                  </p>
                </section>
              )}
              <Penalties match={match} />
            </div>
          )}

          {active === "match" && <MatchSections match={match} events={events} hasStats={hasStats} />}
        </div>
      </div>
    </div>
  );
}

/** The "Match" tab's secondary sections: Overview (stats) / Players (ratings) / Timeline. */
function MatchSections({ match, events, hasStats }: { match: Match; events: MatchEvent[]; hasStats: boolean }) {
  const hasRatings = (match.ratings ?? []).some((r) => r.rating != null);
  const subs: { key: string; label: string }[] = [];
  if (hasStats) subs.push({ key: "overview", label: "Overview" });
  if (hasRatings) subs.push({ key: "players", label: "Players" });
  if (events.length > 0) subs.push({ key: "timeline", label: "Timeline" });
  const [sub, setSub] = useState(subs[0]?.key ?? "overview");
  const active = subs.some((s) => s.key === sub) ? sub : subs[0]?.key;
  if (subs.length === 0) {
    return <p className="card p-4 text-center text-sm text-pitch-400">Match detail appears once the game is under way.</p>;
  }
  return (
    <div className="space-y-4">
      {subs.length > 1 && (
        <div className="flex gap-5 border-b border-white/[0.08]">
          {subs.map((s) => (
            <button
              key={s.key}
              onClick={() => setSub(s.key)}
              className={`-mb-px border-b-2 pb-2 text-sm font-semibold transition ${
                active === s.key ? "border-accent-500 text-white" : "border-transparent text-pitch-400 hover:text-white"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
      {active === "overview" && hasStats && <StatBars match={match} stats={match.stats!} />}
      {active === "players" && <PlayerRatings match={match} />}
      {active === "timeline" && events.length > 0 && <Timeline match={match} events={events} />}
    </div>
  );
}

/** The prediction table — the primary content of the modal. */
function Predictions({ match, predicted }: { match: Match; predicted: MatchPredictionResult[] }) {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-display font-bold text-white">Predictions</h3>
        <span className="text-xs text-pitch-400">
          {match.status === "SCHEDULED"
            ? "points pending"
            : match.status === "FINISHED"
              ? "final points"
              : "live — points at full time"}
        </span>
      </div>
      {predicted.length === 0 ? (
        <p className="text-sm text-pitch-400">No predictions on record for this match.</p>
      ) : (
        <ul className="divide-y divide-white/[0.05]">
          {predicted.map((p) => {
            const onScore = p.live && p.matchesCurrentScore;
            const onResult = p.live && !p.matchesCurrentScore && p.matchesCurrentOutcome;
            return (
              <li
                key={p.participantId}
                className={`flex items-center justify-between rounded-lg px-2 py-2 ${
                  onScore ? "bg-accent-500/10 ring-1 ring-accent-500/30" : onResult ? "bg-white/[0.03]" : ""
                }`}
              >
                <span className="flex items-center gap-2 text-sm text-pitch-100">
                  {p.name}
                  {p.exact && <span title="Exact score">🎯</span>}
                  {!p.exact && p.outcome && <span title="Correct result">✅</span>}
                  {onScore && (
                    <span className="chip bg-accent-500/20 text-accent-300">on the score</span>
                  )}
                  {onResult && (
                    <span className="chip bg-pitch-700 text-pitch-300">on the result</span>
                  )}
                </span>
                <span className="flex items-center gap-3">
                  <span
                    className={`font-mono text-sm tabular-nums ${onScore ? "font-bold text-accent-300" : "text-pitch-300"}`}
                  >
                    {p.predHome}–{p.predAway}
                  </span>
                  {match.status === "FINISHED" && <PointsPill points={p.points} />}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

/** Players from either team that someone picked as a top scorer — who backed them, + goals this game. */
function PickedScorers({ match }: { match: Match }) {
  const { predictions, playerById } = useBarnito();
  const { open } = usePlayerModal();
  const teamIds = new Set([match.homeTeamId, match.awayTeamId]);
  const byPlayer = new Map<string, string[]>();
  for (const part of predictions.participants) {
    for (const pid of part.topPlayers) {
      const pl = playerById.get(pid);
      if (pl && teamIds.has(pl.teamId)) (byPlayer.get(pid) ?? byPlayer.set(pid, []).get(pid)!).push(part.name);
    }
  }
  if (byPlayer.size === 0) return null;
  const goalsOf = (pid: string) => (match.goals ?? []).filter((g) => g.playerId === pid && !g.ownGoal).length;
  const rows = [...byPlayer.entries()]
    .map(([pid, backers]) => ({ pid, p: playerById.get(pid)!, backers, goals: goalsOf(pid) }))
    .filter((r) => r.p)
    .sort((a, b) => b.goals - a.goals || b.backers.length - a.backers.length);
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 font-display font-bold text-white">
        <Target size={15} className="text-accent-400" /> Picked scorers
      </h3>
      <ul className="overflow-hidden rounded-xl border border-white/[0.06]">
        {rows.map((r) => (
          <li key={r.pid} onClick={() => open(r.pid)} className="flex cursor-pointer items-center gap-2.5 border-b border-white/[0.05] px-3 py-2 last:border-0 hover:bg-white/[0.03]">
            <Avatar photo={r.p.photo} name={r.p.name} position={r.p.position} size={30} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="truncate text-sm text-pitch-100">{r.p.name}</span>
                <PosBadge position={r.p.position} />
                <Crest teamId={r.p.teamId} size={12} />
                {r.goals > 0 && <span className="chip bg-accent-500/20 text-[10px] text-accent-300">{r.goals} ⚽</span>}
              </span>
              <span className="block truncate text-[11px] text-pitch-500">Picked by {r.backers.join(", ")}</span>
            </span>
            <ChevronRight size={14} className="shrink-0 text-pitch-600" />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Donut (hollow ring) of how the GROUP predicted this upcoming match: home win / draw / away win. */
function PredictionSplit({
  preds,
  homeName,
  awayName,
}: {
  preds: { predHome: number | null; predAway: number | null }[];
  homeName: string;
  awayName: string;
}) {
  const made = preds.filter((p) => p.predHome != null && p.predAway != null);
  const total = made.length;
  if (total === 0) return null;
  let home = 0, draw = 0, away = 0;
  for (const p of made) {
    const d = (p.predHome as number) - (p.predAway as number);
    if (d > 0) home++;
    else if (d < 0) away++;
    else draw++;
  }
  const pct = (n: number) => Math.round((n / total) * 100);
  const segs = [
    { n: home, color: "#10b981", label: `${homeName} win` },
    { n: draw, color: "#5a6a63", label: "Draw" },
    { n: away, color: "#f97316", label: `${awayName} win` },
  ].filter((s) => s.n > 0);

  const R = 42, C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <section>
      <h3 className="mb-2 font-display font-bold text-white">How the group called it</h3>
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0 -rotate-90">
          <circle cx="60" cy="60" r={R} fill="none" stroke="#1a2320" strokeWidth="14" />
          {segs.map((s, i) => {
            const len = (s.n / total) * C;
            const el = (
              <circle
                key={i}
                cx="60" cy="60" r={R} fill="none" stroke={s.color} strokeWidth="14"
                strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset}
                strokeLinecap="butt"
              />
            );
            offset += len;
            return el;
          })}
          <text x="60" y="56" transform="rotate(90 60 60)" textAnchor="middle" style={{ fill: "#ffffff" }} className="font-display" fontSize="20" fontWeight="800">
            {total}
          </text>
          <text x="60" y="72" transform="rotate(90 60 60)" textAnchor="middle" style={{ fill: "#7c8e86" }} fontSize="9">
            picks
          </text>
        </svg>
        <ul className="flex-1 space-y-1.5 text-sm">
          <Legend color="#10b981" label={`${homeName} win`} value={pct(home)} />
          <Legend color="#5a6a63" label="Draw" value={pct(draw)} />
          <Legend color="#f97316" label={`${awayName} win`} value={pct(away)} />
        </ul>
      </div>
    </section>
  );
}

function Legend({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      <span className="min-w-0 flex-1 truncate text-pitch-200">{label}</span>
      <span className="font-bold tabular-nums text-white">{value}%</span>
    </li>
  );
}

function TeamHead({ teamId, name }: { teamId: string; name: string }) {
  return (
    <div className="flex flex-1 flex-col items-center gap-1.5">
      <Crest teamId={teamId} size={44} />
      <span className="text-center text-sm font-semibold text-white">{name}</span>
    </div>
  );
}

// --- timeline --------------------------------------------------------------
function eventGlyph(e: MatchEvent) {
  if (e.type === "GOAL")
    return <span className="grid h-5 w-5 place-items-center rounded-full bg-accent-500/20 text-accent-300">⚽</span>;
  if (e.type === "CARD")
    return (
      <span
        className={`h-4 w-3 rounded-[2px] ${
          /red/i.test(e.detail) ? "bg-red-500" : "bg-yellow-400"
        }`}
      />
    );
  if (e.type === "SUBST")
    return <ArrowLeftRight size={14} className="text-pitch-400" />;
  return <Sparkles size={14} className="text-spice-400" />;
}

function Timeline({ match, events }: { match: Match; events: MatchEvent[] }) {
  return (
    <section>
      <h3 className="mb-2 font-display font-bold text-white">Timeline</h3>
      <ul className="space-y-2">
        {events.map((e, i) => {
          const home = e.teamId === match.homeTeamId;
          return (
            <li
              key={i}
              className={`flex items-center gap-2 text-sm ${home ? "" : "flex-row-reverse text-right"}`}
            >
              <span className="w-9 shrink-0 text-center font-mono text-xs text-pitch-500">
                {e.minute != null ? `${e.minute}'` : ""}
              </span>
              {eventGlyph(e)}
              <span className={`min-w-0 flex-1 ${home ? "" : "text-right"}`}>
                <span className="truncate text-pitch-100">{e.playerName}</span>
                {e.type === "GOAL" && /own/i.test(e.detail) && (
                  <span className="text-red-400"> (OG)</span>
                )}
                {e.type === "GOAL" && /penalty/i.test(e.detail) && (
                  <span className="text-pitch-400"> (pen)</span>
                )}
                {e.assistName && (
                  <span className="block text-[11px] text-pitch-500">
                    {e.type === "SUBST" ? "↳ " : "assist "} {e.assistName}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --- match stat bars -------------------------------------------------------
// [api stat type, display label]; labels keep the bars readable.
const SHOWN_STATS: [string, string][] = [
  ["Ball Possession", "Possession"],
  ["expected_goals", "xG"],
  ["Total Shots", "Shots"],
  ["Shots on Goal", "On target"],
  ["Shots insidebox", "Shots in box"],
  ["Total passes", "Passes"],
  ["Passes %", "Pass accuracy"],
  ["Corner Kicks", "Corners"],
  ["Fouls", "Fouls"],
  ["Offsides", "Offsides"],
  ["Goalkeeper Saves", "Saves"],
];
function toNum(v: string | number | null): number {
  if (v == null) return 0;
  return typeof v === "number" ? v : Number(String(v).replace("%", "")) || 0;
}
function StatBars({ match, stats }: { match: Match; stats: TeamStat[] }) {
  const home = stats.find((s) => s.teamId === match.homeTeamId);
  const away = stats.find((s) => s.teamId === match.awayTeamId);
  if (!home || !away) return null;
  const get = (s: TeamStat, type: string) => s.items.find((i) => i.type === type)?.value ?? null;

  return (
    <section>
      <h3 className="mb-2 font-display font-bold text-white">Match stats</h3>
      <div className="space-y-3">
        {SHOWN_STATS.map(([type, label]) => {
          const hv = get(home, type);
          const av = get(away, type);
          if (hv == null && av == null) return null;
          const h = toNum(hv);
          const a = toNum(av);
          const total = h + a || 1;
          return (
            <div key={type}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-semibold tabular-nums text-pitch-100">{hv ?? 0}</span>
                <span className="text-pitch-400">{label}</span>
                <span className="font-semibold tabular-nums text-pitch-100">{av ?? 0}</span>
              </div>
              <div className="flex h-1.5 gap-0.5">
                <div className="flex flex-1 justify-end overflow-hidden rounded-l-full bg-pitch-800">
                  <div className="h-full origin-right animate-bar-grow rounded-l-full bg-accent-500" style={{ width: `${(h / total) * 100}%` }} />
                </div>
                <div className="flex flex-1 overflow-hidden rounded-r-full bg-pitch-800">
                  <div className="h-full origin-left animate-bar-grow rounded-r-full bg-spice-500" style={{ width: `${(a / total) * 100}%` }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- player ratings + per-match report cards -------------------------------
function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-white/[0.04] px-2 py-1.5 text-center">
      <div className="font-display text-sm font-bold tabular-nums text-white">{value}</div>
      <div className="text-[9px] uppercase tracking-wide text-pitch-500">{label}</div>
    </div>
  );
}

function ReportCard({ r }: { r: PlayerRating }) {
  const pen = (r.penScored ?? 0) + (r.penMissed ?? 0) + (r.penSaved ?? 0) + (r.penWon ?? 0) + (r.penCommitted ?? 0);
  // API gives passes.accuracy as the count of accurate passes — turn it into a %.
  const passPct = r.passes && r.passAcc != null ? Math.round((r.passAcc / r.passes) * 100) : null;
  return (
    <div className="grid grid-cols-3 gap-1.5 border-t border-white/[0.06] bg-black/10 p-2.5 sm:grid-cols-4">
      {r.minutes != null && <StatCell label="Mins" value={r.minutes} />}
      {!!r.goals && <StatCell label="Goals" value={r.goals} />}
      {!!r.assists && <StatCell label="Assists" value={r.assists} />}
      <StatCell label="Shots" value={`${r.shotsOn ?? 0}/${r.shotsTotal ?? 0}`} />
      <StatCell label="Passes" value={passPct != null ? `${r.passes} · ${passPct}%` : (r.passes ?? 0)} />
      {!!r.keyPasses && <StatCell label="Key passes" value={r.keyPasses} />}
      <StatCell label="Duels" value={`${r.duelsWon ?? 0}/${r.duelsTotal ?? 0}`} />
      {!!r.dribbleAtt && <StatCell label="Dribbles" value={`${r.dribbleSucc ?? 0}/${r.dribbleAtt}`} />}
      <StatCell label="Tackles" value={r.tackles ?? 0} />
      {!!r.interceptions && <StatCell label="Intercept." value={r.interceptions} />}
      <StatCell label="Fouls" value={`${r.foulsCommitted ?? 0}`} />
      {pen > 0 && <StatCell label="Pens (S/M)" value={`${r.penScored ?? 0}/${r.penMissed ?? 0}`} />}
    </div>
  );
}

function PlayerRatings({ match }: { match: Match }) {
  const { open } = usePlayerModal();
  const [openKey, setOpenKey] = useState<string | null>(null);
  const ranked = (match.ratings ?? []).filter((r) => r.rating != null).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  if (ranked.length === 0) return null;
  const ratingTint = (v: number) => (v >= 7.5 ? "bg-accent-500/25 text-accent-200" : v >= 6.5 ? "bg-white/10 text-pitch-100" : "bg-pitch-800 text-pitch-300");

  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 font-display font-bold text-white">
        <Star size={15} className="text-spice-400" /> Player ratings
      </h3>
      <div className="overflow-hidden rounded-xl border border-white/[0.06]">
        {ranked.map((r, i) => {
          const key = r.playerId ?? `${r.teamId}-${i}`;
          const isOpen = openKey === key;
          return (
            <div key={key} className="border-b border-white/[0.05] last:border-0">
              <div className="flex items-center gap-2 px-2.5 py-2">
                <span className="w-4 text-center text-[11px] font-bold text-pitch-600">{i + 1}</span>
                <Crest teamId={r.teamId} size={15} />
                <button
                  type="button"
                  onClick={() => r.playerId && open(r.playerId)}
                  className={`min-w-0 flex-1 truncate text-left text-sm text-pitch-100 ${r.playerId ? "hover:text-white" : ""}`}
                >
                  {r.name}{r.captain ? " (C)" : ""}
                </button>
                <span className={`chip font-bold tabular-nums ${ratingTint(r.rating ?? 0)}`}>{r.rating?.toFixed(1)}</span>
                <button
                  type="button"
                  onClick={() => setOpenKey(isOpen ? null : key)}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-pitch-500 hover:bg-white/5 hover:text-white"
                  aria-label="Toggle report card"
                >
                  <ChevronDown size={15} className={`transition ${isOpen ? "rotate-180" : ""}`} />
                </button>
              </div>
              {isOpen && <ReportCard r={r} />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// --- penalties (this match) ------------------------------------------------
function Penalties({ match }: { match: Match }) {
  // In-play penalties from the event feed, plus any keeper saves from the per-player line.
  const taken = (match.events ?? [])
    .filter((e) => e.type === "GOAL" && /penalt/i.test(e.detail))
    .map((e) => ({ name: e.playerName, teamId: e.teamId, minute: e.minute, scored: !/missed/i.test(e.detail) }));
  const saves = (match.ratings ?? []).filter((r) => (r.penSaved ?? 0) > 0);
  if (taken.length === 0 && saves.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 font-display font-bold text-white">Penalties</h3>
      <ul className="space-y-1.5 text-[13px]">
        {taken.map((t, i) => (
          <li key={i} className="flex items-center gap-2">
            <span className="w-9 shrink-0 text-center font-mono text-xs text-pitch-500">{t.minute != null ? `${t.minute}'` : ""}</span>
            <Crest teamId={t.teamId} size={15} />
            <span className="min-w-0 flex-1 truncate text-pitch-100">{t.name}</span>
            <span className={`chip ${t.scored ? "bg-accent-500/20 text-accent-300" : "bg-red-500/20 text-red-300"}`}>
              {t.scored ? "Scored" : "Missed"}
            </span>
          </li>
        ))}
        {saves.map((r, i) => (
          <li key={`s${i}`} className="flex items-center gap-2">
            <span className="w-9 shrink-0" />
            <Crest teamId={r.teamId} size={15} />
            <span className="min-w-0 flex-1 truncate text-pitch-100">{r.name}</span>
            <span className="chip bg-sky-500/20 text-sky-300">Saved {(r.penSaved ?? 0) > 1 ? `×${r.penSaved}` : ""}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

// --- lineups (combined formation pitch) ------------------------------------
type Side = "home" | "away";

function PitchToken({ p, x, y, side, card }: { p: LineupPlayer; x: number; y: number; side: Side; card?: "yellow" | "red" }) {
  const { open } = usePlayerModal();
  const fill = side === "home" ? "bg-sky-500" : "bg-spice-500";
  return (
    <button
      type="button"
      disabled={!p.playerId}
      onClick={() => p.playerId && open(p.playerId)}
      style={{ left: `${x}%`, top: `${y}%` }}
      className={`absolute flex w-[18%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5 ${p.playerId ? "cursor-pointer" : "cursor-default"}`}
      title={card ? `${p.name} · ${card === "red" ? "sent off" : "booked"}` : p.name}
    >
      <span className={`relative grid h-7 w-7 place-items-center rounded-full text-[10px] font-bold text-white shadow-md ring-2 ring-white/85 ${fill}`}>
        {p.number ?? ""}
        {card && (
          <span className={`absolute -right-1 -top-1 h-2.5 w-[7px] rounded-[1px] ring-1 ring-pitch-950/70 ${card === "red" ? "bg-red-500" : "bg-yellow-400"}`} />
        )}
      </span>
      <span className="max-w-full truncate rounded-sm bg-pitch-950/70 px-1 text-[8.5px] font-medium leading-tight text-white">
        {lastName(p.name)}
      </span>
    </button>
  );
}

/** Position one team's XI by grid into its half of the pitch (home bottom, away top, mirrored). */
function placeTeam(l: Lineup, side: Side): { p: LineupPlayer; x: number; y: number }[] {
  const byRow = new Map<number, LineupPlayer[]>();
  for (const p of l.startXI) {
    const row = p.grid ? Number(p.grid.split(":")[0]) : 0;
    (byRow.get(row) ?? byRow.set(row, []).get(row)!).push(p);
  }
  const rows = [...byRow.entries()].sort((a, b) => a[0] - b[0]); // row 1 = GK first
  for (const [, ps] of rows) ps.sort((a, b) => Number(a.grid?.split(":")[1] ?? 0) - Number(b.grid?.split(":")[1] ?? 0));
  const n = rows.length;
  const out: { p: LineupPlayer; x: number; y: number }[] = [];
  rows.forEach(([, ps], r) => {
    const frac = n <= 1 ? 0 : r / (n - 1); // 0 = GK line, 1 = furthest forward
    const yM = side === "home" ? 101 - frac * 45 : 4 + frac * 45; // metres; stay clear of halfway
    ps.forEach((p, i) => {
      const idx = side === "home" ? i : ps.length - 1 - i; // mirror away so both attack the centre
      const xM = 9 + ((idx + 0.5) / ps.length) * 50;
      out.push({ p, x: (xM / 68) * 100, y: (yM / 105) * 100 });
    });
  });
  return out;
}

function EndLabel({ teamId, formation, side }: { teamId: string; formation: string | null; side: Side }) {
  const dot = side === "home" ? "bg-sky-400" : "bg-spice-400";
  return (
    <div className={`absolute left-2 ${side === "home" ? "bottom-2" : "top-2"} flex items-center gap-1.5 rounded-full bg-pitch-950/55 px-2 py-0.5 text-[10px] font-semibold text-white backdrop-blur-sm`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      <Crest teamId={teamId} size={13} />
      <span>{formation ?? "XI"}</span>
    </div>
  );
}

/** Who is carrying a card in THIS match (from the timeline): two yellows or a red ⇒ red. */
function matchCards(match: Match) {
  const yellow = new Map<string, number>();
  const red = new Set<string>();
  for (const e of match.events ?? []) {
    if (e.type !== "CARD" || !e.playerId) continue;
    if (/red/i.test(e.detail)) red.add(e.playerId);
    else yellow.set(e.playerId, (yellow.get(e.playerId) ?? 0) + 1);
  }
  return (pid: string | null): "yellow" | "red" | undefined => {
    if (!pid) return undefined;
    if (red.has(pid) || (yellow.get(pid) ?? 0) >= 2) return "red";
    if ((yellow.get(pid) ?? 0) >= 1) return "yellow";
    return undefined;
  };
}

function CombinedPitch({ home, away, match }: { home?: Lineup; away?: Lineup; match: Match }) {
  const cardOf = matchCards(match);
  const tokens = [
    ...(home ? placeTeam(home, "home").map((t) => ({ ...t, side: "home" as Side })) : []),
    ...(away ? placeTeam(away, "away").map((t) => ({ ...t, side: "away" as Side })) : []),
  ];
  return (
    <div
      className="relative mx-auto w-full max-w-[22rem] overflow-hidden rounded-2xl shadow-[inset_0_0_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
      style={{ aspectRatio: "68 / 105" }}
    >
      <PitchMarkings />
      {away && <EndLabel teamId={away.teamId} formation={away.formation} side="away" />}
      {home && <EndLabel teamId={home.teamId} formation={home.formation} side="home" />}
      {tokens.map((t, i) => (
        <PitchToken key={t.p.playerId ?? i} p={t.p} x={t.x} y={t.y} side={t.side} card={cardOf(t.p.playerId)} />
      ))}
    </div>
  );
}

function SubsList({ l, side }: { l: Lineup; side: Side }) {
  if (l.subs.length === 0) return null;
  const dot = side === "home" ? "bg-sky-400" : "bg-spice-400";
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-pitch-300">
        <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
        <Crest teamId={l.teamId} size={13} /> Bench
      </div>
      <div className="flex flex-wrap gap-1">
        {l.subs.map((p, i) => (
          <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white/[0.05] px-1.5 py-0.5 text-[10px] text-pitch-200">
            <span className="font-mono text-[9px] text-pitch-500">{p.number ?? "–"}</span>
            {lastName(p.name)}
          </span>
        ))}
      </div>
    </div>
  );
}

function Lineups({ match }: { match: Match }) {
  const home = match.lineups?.find((l) => l.teamId === match.homeTeamId);
  const away = match.lineups?.find((l) => l.teamId === match.awayTeamId);
  if (!home && !away) return null;
  const hasGrid = [home, away].some((l) => l?.startXI.some((p) => p.grid));

  return (
    <section>
      <h3 className="mb-2 font-display font-bold text-white">Lineups</h3>
      {hasGrid ? (
        <>
          <CombinedPitch home={home} away={away} match={match} />
          <div className="mt-3 grid grid-cols-2 gap-3">
            {home && <SubsList l={home} side="home" />}
            {away && <SubsList l={away} side="away" />}
          </div>
        </>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {[home, away].map((l, idx) =>
            l ? (
              <div key={idx} className="space-y-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-pitch-300">
                  <Crest teamId={l.teamId} size={16} />
                  <span className="truncate">{l.formation ?? "XI"}</span>
                </div>
                <ul className="space-y-1 text-[13px]">
                  {l.startXI.map((p, i) => (
                    <li key={i} className="flex items-center gap-1.5 text-pitch-200">
                      <span className="w-5 text-right font-mono text-[11px] text-pitch-500">{p.number ?? ""}</span>
                      <span className="truncate">{p.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div key={idx} />
            ),
          )}
        </div>
      )}
    </section>
  );
}
