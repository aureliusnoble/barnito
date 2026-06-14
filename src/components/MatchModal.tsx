import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { X, MapPin, ArrowLeftRight, Star, Sparkles, Swords } from "lucide-react";
import { useBarnito, useHelpers } from "../data/store";
import { StatusBadge, PointsPill, GroupPill, Crest, ScorerPickTags } from "./bits";
import { formatFull, ordinal } from "../lib/format";
import { WC_HISTORY } from "../data/wcHistory";
import type { Match, MatchEvent, MatchPredictionResult, TeamStat } from "@shared/types";

type FormResult = "W" | "D" | "L";
function FormRow({ form }: { form: FormResult[] }) {
  const c = { W: "bg-accent-500", D: "bg-pitch-500", L: "bg-red-500" };
  if (form.length === 0) return <span className="text-pitch-600">—</span>;
  return <span className="flex gap-0.5">{form.slice(-4).map((r, i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${c[r]}`} title={r} />)}</span>;
}
function InfoRow({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between text-xs"><span className="text-pitch-400">{label}</span><span className="font-semibold text-pitch-100">{children}</span></div>;
}

function TeamInfo({ match }: { match: Match }) {
  const { teamById, standings, matches } = useBarnito();
  const form = useMemo(() => {
    const map = new Map<string, FormResult[]>();
    for (const m of matches.matches.filter((m) => m.status === "FINISHED" && m.homeGoals != null && m.awayGoals != null).sort((a, b) => a.kickoff.localeCompare(b.kickoff))) {
      const hr: FormResult = m.homeGoals! > m.awayGoals! ? "W" : m.homeGoals! < m.awayGoals! ? "L" : "D";
      (map.get(m.homeTeamId) ?? map.set(m.homeTeamId, []).get(m.homeTeamId)!).push(hr);
      (map.get(m.awayTeamId) ?? map.set(m.awayTeamId, []).get(m.awayTeamId)!).push(hr === "W" ? "L" : hr === "L" ? "W" : "D");
    }
    return map;
  }, [matches]);
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
              <div className="flex items-center justify-between text-xs"><span className="text-pitch-400">Form</span><FormRow form={form.get(id) ?? []} /></div>
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

function H2H({ match }: { match: Match }) {
  if (!match.h2h || match.h2h.length === 0) return null;
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 font-display font-bold text-white"><Swords size={15} className="text-pitch-400" /> Head-to-head</h3>
      <ul className="space-y-1.5">
        {match.h2h.map((h, i) => (
          <li key={i} className="flex items-center justify-between gap-2 text-[13px]">
            <span className="w-16 shrink-0 text-[11px] text-pitch-500">{h.date.slice(0, 10)}</span>
            <span className="min-w-0 flex-1 truncate text-pitch-200">{h.homeName} <span className="font-bold tabular-nums text-white">{h.homeGoals}–{h.awayGoals}</span> {h.awayName}</span>
            <span className="hidden shrink-0 truncate text-[10px] text-pitch-600 sm:block" style={{ maxWidth: "8rem" }}>{h.league}</span>
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
  const hasMatchDetail = events.length > 0 || hasStats || hasRatings || hasLineups;

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
          {match.status !== "FINISHED" && (
            <ScorerPickTags match={match} className="mt-2 justify-center" />
          )}
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
            </div>
          )}

          {active === "info" && (
            <div className="space-y-5">
              <TeamInfo match={match} />
              <H2H match={match} />
            </div>
          )}

          {active === "match" && (
            <div className="space-y-5">
              {events.length > 0 && <Timeline match={match} events={events} />}
              {hasStats && <StatBars match={match} stats={match.stats!} />}
              <TopPerformers match={match} />
              {hasLineups && <Lineups match={match} />}
            </div>
          )}
        </div>
      </div>
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

// --- live stat bars --------------------------------------------------------
const SHOWN_STATS = ["Ball Possession", "Total Shots", "Shots on Goal", "Corner Kicks"];
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
        {SHOWN_STATS.map((type) => {
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
                <span className="text-pitch-400">{type}</span>
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

// --- top performers (ratings) ---------------------------------------------
function TopPerformers({ match }: { match: Match }) {
  const ratings = (match.ratings ?? []).filter((r) => r.rating != null);
  if (ratings.length === 0) return null;
  const top = [...ratings].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 3);
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 font-display font-bold text-white">
        <Star size={15} className="text-spice-400" /> Top performers
      </h3>
      <div className="flex gap-2">
        {top.map((r, i) => (
          <div key={i} className="card flex flex-1 items-center gap-2 p-2">
            <Crest teamId={r.teamId} size={16} />
            <span className="min-w-0 flex-1 truncate text-xs text-pitch-100">{r.name}</span>
            <span className="chip bg-accent-500/20 font-bold text-accent-300">{r.rating?.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

// --- lineups ---------------------------------------------------------------
function Lineups({ match }: { match: Match }) {
  const home = match.lineups?.find((l) => l.teamId === match.homeTeamId);
  const away = match.lineups?.find((l) => l.teamId === match.awayTeamId);
  if (!home && !away) return null;
  return (
    <section>
      <h3 className="mb-2 font-display font-bold text-white">Lineups</h3>
      <div className="grid grid-cols-2 gap-3">
        {[home, away].map((l, idx) =>
          l ? (
            <div key={idx}>
              <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-pitch-300">
                <Crest teamId={l.teamId} size={16} />
                <span className="truncate">{l.formation ?? "XI"}</span>
              </div>
              <ul className="space-y-1 text-[13px]">
                {l.startXI.map((p, i) => (
                  <li key={i} className="flex items-center gap-1.5 text-pitch-200">
                    <span className="w-5 text-right font-mono text-[11px] text-pitch-500">
                      {p.number ?? ""}
                    </span>
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
    </section>
  );
}
