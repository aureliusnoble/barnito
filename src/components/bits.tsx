import { Target, Flame, Tv } from "lucide-react";
import type { Match, MatchStatus, Position, Player } from "@shared/types";
import { useBarnito, useHelpers } from "../data/store";
import { useTick, liveMinute } from "../lib/clock";
import { POSITION_LABEL } from "../lib/format";
import { broadcasterFor } from "../lib/broadcasters";
import { teamFlag, type Flag } from "../lib/teamColors";
import { Crest, Avatar } from "./visuals";
import { lastName } from "./Pitch";

export { Crest } from "./visuals";

const DRAW_COLOR = "#5a6a63";
// ring geometry (viewBox 36): inner/outer radius and derived thickness/mid-radius
const RI = 7.5, RO = 15.5, THK = RO - RI, RMID = (RI + RO) / 2;

/**
 * Donut of how the group predicted a match: home-win / draw / away-win. Each outcome arc is
 * drawn as that team's flag — stripes run *around* the arc for vertical flags (France) and as
 * *concentric* bands for horizontal flags (Argentina, Germany), sized by each colour's real
 * share of the flag — with a clear gap between arcs and a country-code label outside each.
 * When everyone agrees on one outcome the whole ring is that flag, marked with a check badge.
 */
export function PredictionDonut({ matchId, size = 84, labels = true }: { matchId: string; size?: number; labels?: boolean }) {
  const { scores, matchById, teamById } = useBarnito();
  const { teamName } = useHelpers();
  const pm = scores.perMatch.find((p) => p.matchId === matchId);
  const m = matchById.get(matchId);
  if (!pm || !m) return null;
  const made = pm.predictions.filter((p) => p.predHome != null && p.predAway != null);
  const total = made.length;
  if (total === 0) return null;

  let home = 0, draw = 0, away = 0;
  for (const p of made) {
    const d = (p.predHome as number) - (p.predAway as number);
    if (d > 0) home++; else if (d < 0) away++; else draw++;
  }
  const drawFlag: Flag = { colors: [DRAW_COLOR], dir: "v" };
  const segs = [
    { n: home, teamId: m.homeTeamId, flag: teamFlag(m.homeTeamId), label: `${teamName(m.homeTeamId)} ${home}` },
    { n: draw, teamId: null, flag: drawFlag, label: `Draw ${draw}` },
    { n: away, teamId: m.awayTeamId, flag: teamFlag(m.awayTeamId), label: `${teamName(m.awayTeamId)} ${away}` },
  ].filter((s) => s.n > 0);

  const CC = labels ? 28 : 18;          // viewBox centre; extra room for outside label badges
  const RLAB = RO + 5.1;                // label-badge radius — clears the ring (RO) so it never overlaps
  const gapFrac = 0.05;                 // angular gap (fraction of circle) between/around arcs
  const arcs: { r: number; color: string; span: number; start: number; w: number }[] = [];
  const tags: { code: string; frac: number }[] = [];
  let start = 0;
  for (const s of segs) {
    const segFrac = s.n / total;
    const usable = Math.max(0.0001, segFrac - gapFrac);
    const cols = s.flag.colors;
    const ws = s.flag.weights ?? cols.map(() => 1);
    const sumW = ws.reduce((a, b) => a + b, 0);
    if (s.flag.dir === "h" && cols.length > 1) {
      let cum = 0;
      cols.forEach((color, k) => { const bw = THK * (ws[k] / sumW); arcs.push({ r: RI + cum + bw / 2, color, span: usable, start, w: bw }); cum += bw; });
    } else {
      let cum = 0;
      cols.forEach((color, k) => { const piece = usable * (ws[k] / sumW); arcs.push({ r: RMID, color, span: piece, start: start + cum, w: THK }); cum += piece; });
    }
    const code = s.teamId ? teamById.get(s.teamId)?.code : null;
    if (code && labels) tags.push({ code, frac: start + usable / 2 }); // centre of the *drawn* band
    start += segFrac;
  }
  const unanimous = total > 1 && segs.length === 1; // everyone (>1 person) agreed

  const arcEl = (a: typeof arcs[number], key: number) => {
    const c = 2 * Math.PI * a.r;
    const dash = a.span * c;
    return (
      <circle
        key={key} cx={CC} cy={CC} r={a.r} fill="none" stroke={a.color} strokeWidth={a.w}
        strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-a.start * c} strokeLinecap="butt"
      />
    );
  };
  // place the unanimous "100%" badge just off the ring's top-right (≈45° from the top)
  const rBadge = RO + 2.5;
  const badgeLeft = ((CC + rBadge * Math.SQRT1_2) / (CC * 2)) * 100;
  const badgeTop = ((CC - rBadge * Math.SQRT1_2) / (CC * 2)) * 100;
  return (
    <span className="relative inline-flex shrink-0 align-middle" style={{ width: size, height: size }}>
      <svg
        viewBox={`0 0 ${CC * 2} ${CC * 2}`} width={size} height={size}
        role="img" aria-label={`Predictions: ${segs.map((s) => s.label).join(", ")}`}
      >
        <title>{segs.map((s) => s.label).join(" · ")}{unanimous ? " (unanimous)" : ""}</title>
        <g transform={`rotate(-90 ${CC} ${CC})`}>
          <circle cx={CC} cy={CC} r={RMID} fill="none" stroke="#1a2320" strokeWidth={THK} />
          {arcs.map(arcEl)}
        </g>
        {tags.map((t, i) => {
          const x = CC + RLAB * Math.sin(2 * Math.PI * t.frac);
          const y = CC - RLAB * Math.cos(2 * Math.PI * t.frac);
          const fs = 6;
          const bw = t.code.length * fs * 0.66 + 3.2; // pill sized to the code
          const bh = fs + 3;
          return (
            <g key={i}>
              <rect
                x={x - bw / 2} y={y - bh / 2} width={bw} height={bh} rx={bh / 2}
                fill="#f4c531" stroke="#0b1512" strokeWidth="0.5"
              />
              <text
                x={x} y={y} fontSize={fs} textAnchor="middle" dominantBaseline="central" fontWeight="800"
                fill="#1c1606" style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
              >
                {t.code}
              </text>
            </g>
          );
        })}
      </svg>
      {unanimous && (
        <span
          style={{ left: `${badgeLeft}%`, top: `${badgeTop}%` }}
          className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent-500 px-1 py-px text-[8px] font-extrabold leading-none text-pitch-950 ring-2 ring-pitch-900"
          title="Everyone agreed"
        >
          100%
        </span>
      )}
    </span>
  );
}

/** UK free-to-air channel chip (BBC / ITV) for a fixture, or nothing if not yet confirmed. */
export function BroadcastBadge({ match, className = "" }: { match: Match; className?: string }) {
  const b = broadcasterFor(match.homeTeamId, match.awayTeamId);
  if (!b) return null;
  const tone = b === "BBC"
    ? "bg-sky-500/15 text-sky-300 ring-sky-500/25"
    : "bg-amber-500/15 text-amber-300 ring-amber-500/25";
  return (
    <span
      title={`Watch on ${b} (UK)`}
      className={`inline-flex items-center gap-0.5 rounded px-1 py-px text-[9px] font-bold leading-none ring-1 ${tone} ${className}`}
    >
      <Tv size={8} strokeWidth={2.5} />
      {b}
    </span>
  );
}

const POS_LETTER: Record<Position, string> = { GK: "G", DEF: "D", MID: "M", FWD: "F" };
const POS_BADGE: Record<Position, string> = {
  GK: "bg-purple-500/20 text-purple-300",
  DEF: "bg-sky-500/20 text-sky-300",
  MID: "bg-accent-500/20 text-accent-300",
  FWD: "bg-spice-500/20 text-spice-300",
};
/** Compact single-letter position badge (G/D/M/F), colour-coded by position. */
export function PosBadge({ position, className = "" }: { position?: Position | null; className?: string }) {
  if (!position) return null;
  return (
    <span
      title={POSITION_LABEL[position]}
      className={`inline-grid h-4 w-4 shrink-0 place-items-center rounded text-[9px] font-bold leading-none ${POS_BADGE[position]} ${className}`}
    >
      {POS_LETTER[position]}
    </span>
  );
}

/**
 * "Hot take": exactly one participant is alone in their predicted *outcome* (win/draw/loss,
 * ignoring the scoreline) — no one else backs it, however the rest split. Needs ≥3 predictions.
 */
export function HotTakeBadge({ matchId }: { matchId: string }) {
  const { scores, matchById } = useBarnito();
  const { teamName } = useHelpers();
  const pm = scores.perMatch.find((p) => p.matchId === matchId);
  const m = matchById.get(matchId);
  if (!pm || !m) return null;
  const made = pm.predictions.filter((p) => p.predHome != null && p.predAway != null);
  if (made.length < 3) return null;
  const outcome = (p: (typeof made)[number]) => Math.sign((p.predHome as number) - (p.predAway as number));
  const groups = new Map<number, typeof made>();
  for (const p of made) (groups.get(outcome(p)) ?? groups.set(outcome(p), []).get(outcome(p))!).push(p);
  // a hot take = exactly one participant alone in their outcome (others may split among the rest)
  const lones = [...groups.entries()].filter(([, ps]) => ps.length === 1);
  if (lones.length !== 1) return null;
  const lone = { name: lones[0][1][0].name, o: lones[0][0] };
  const label = lone.o > 0 ? teamName(m.homeTeamId) : lone.o < 0 ? teamName(m.awayTeamId) : "a draw";
  const verb = lone.o === 0 ? "tips" : "backs";
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-spice-500/15 px-2 py-0.5 text-[10px] font-semibold text-spice-300">
      <Flame size={10} className="fill-spice-500 text-spice-500" /> Hot take · {lone.name} alone {verb} {label}
    </span>
  );
}

/** A booking flag: red card takes precedence over a yellow; renders nothing if the player is clean. */
export function CardFlag({ yellow, red, size = 13 }: { yellow?: boolean; red?: boolean; size?: number }) {
  if (!red && !yellow) return null;
  return (
    <span
      title={red ? "Carrying a red (suspended)" : "Carrying a booking"}
      className={`inline-block shrink-0 rounded-[2px] ${red ? "bg-red-500" : "bg-yellow-400"}`}
      style={{ width: size * 0.72, height: size }}
    />
  );
}

/** Map a raw spiciness score to a 1–5 rating, relative to the hottest upcoming game. */
export function spiceRating(score: number, max: number): number {
  if (max <= 0 || score <= 0) return 1;
  return Math.max(1, Math.min(5, Math.round((score / max) * 5)));
}

/** Spice shown as 1–5 chillis (filled out of five) instead of a raw number. */
export function SpiceRating({
  score,
  max,
  size = 14,
  showLabel = false,
}: {
  score: number;
  max: number;
  size?: number;
  showLabel?: boolean;
}) {
  const r = spiceRating(score, max);
  return (
    <span className="inline-flex items-center gap-0.5 align-middle" title={`Spice ${r}/5`} aria-label={`Spice rating ${r} out of 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <span
          key={i}
          aria-hidden
          style={{ fontSize: size, lineHeight: 1, opacity: i < r ? 1 : 0.25 }}
          className={i < r ? "" : "grayscale"}
        >
          🌶️
        </span>
      ))}
      {showLabel && <span className="ml-1 text-xs font-semibold text-spice-300">{r}/5</span>}
    </span>
  );
}

/**
 * Picked scorers playing in this match, shown player-first: each chip is the player (photo +
 * surname + crest) with the people who backed them as small secondary text. Grouped by player
 * and ordered by how many backed them; capped with a "+N" overflow so the card stays minimal
 * (full detail lives in the match modal). Returns null when nobody has a pick on either side.
 */
export function ScorerPickTags({ match, className = "" }: { match: Match; className?: string }) {
  const { predictions, playerById } = useBarnito();
  const teamIds = new Set([match.homeTeamId, match.awayTeamId]);
  const firstName = (n: string) => n.split(" ")[0];
  const byPlayer = new Map<string, { player: Player; backers: string[] }>();
  for (const part of predictions.participants) {
    for (const pid of part.topPlayers) {
      const pl = playerById.get(pid);
      if (pl && teamIds.has(pl.teamId)) {
        const e = byPlayer.get(pid) ?? { player: pl, backers: [] };
        e.backers.push(part.name);
        byPlayer.set(pid, e);
      }
    }
  }
  if (byPlayer.size === 0) return null;
  const rows = [...byPlayer.values()].sort((a, b) => b.backers.length - a.backers.length);
  const CAP = 4;
  const shown = rows.slice(0, CAP);
  const extra = rows.length - shown.length;
  return (
    <div className={`flex flex-wrap items-center gap-1.5 ${className}`}>
      <Target size={12} className="shrink-0 text-accent-400" />
      {shown.map(({ player, backers }) => (
        <span
          key={player.id}
          title={`${player.name} — picked by ${backers.join(", ")}`}
          className="inline-flex items-center gap-1 rounded-full bg-white/[0.04] py-0.5 pl-0.5 pr-2 ring-1 ring-white/[0.07]"
        >
          <Avatar photo={player.photo} name={player.name} position={player.position} size={18} />
          <Crest teamId={player.teamId} size={9} />
          <span className="text-[11px] font-semibold leading-none text-pitch-100">{lastName(player.name)}</span>
          <span className="max-w-[8rem] truncate text-[9.5px] leading-none text-pitch-400">
            {backers.map(firstName).join(", ")}
          </span>
        </span>
      ))}
      {extra > 0 && (
        <span className="rounded-full bg-white/[0.04] px-2 py-1 text-[10px] font-semibold text-pitch-400 ring-1 ring-white/[0.07]">
          +{extra}
        </span>
      )}
    </div>
  );
}

/** Crest + team name, optionally reversed for the away side. */
export function TeamLabel({
  teamId,
  align = "left",
  size = 22,
  className = "",
}: {
  teamId: string;
  align?: "left" | "right";
  size?: number;
  className?: string;
}) {
  const { teamName } = useHelpers();
  return (
    <span
      className={`flex min-w-0 items-center gap-2 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      } ${className}`}
    >
      <Crest teamId={teamId} size={size} />
      <span className="truncate">{teamName(teamId)}</span>
    </span>
  );
}

const STATUS_STYLE: Record<MatchStatus, string> = {
  SCHEDULED: "bg-pitch-800 text-pitch-300",
  LIVE: "bg-red-500 text-white",
  HT: "bg-spice-500 text-black",
  FINISHED: "bg-pitch-700 text-pitch-300",
};

export function StatusBadge({ match }: { match: Match }) {
  const { matches } = useBarnito();
  const isLive = match.status === "LIVE";
  useTick(isLive); // tick the live clock forward between data snapshots
  let label: string = match.status;
  if (isLive) label = liveMinute(match.elapsed, matches.updatedAt);
  if (match.status === "HT") label = "HT";
  if (match.status === "FINISHED") label = "FT";
  if (match.status === "SCHEDULED") label = "—";
  return (
    <span className={`chip tabular-nums ${STATUS_STYLE[match.status]}`}>
      {match.status === "LIVE" && (
        <span className="relative flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/80" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-white" />
        </span>
      )}
      {label}
    </span>
  );
}

export function PointsPill({
  points,
  provisional = false,
}: {
  points: number;
  provisional?: boolean;
}) {
  if (points <= 0) return <span className="chip bg-pitch-800/70 text-pitch-400">0</span>;
  return (
    <span
      className={`chip ${
        provisional ? "bg-spice-500/20 text-spice-300" : "bg-accent-500/20 text-accent-300"
      }`}
      title={provisional ? "Provisional — match still in progress" : undefined}
    >
      +{points}
      {provisional && "*"}
    </span>
  );
}

export function GroupPill({ group }: { group: string }) {
  return <span className="chip bg-pitch-800/80 text-pitch-300">Group {group}</span>;
}

export function SectionTitle({
  children,
  hint,
  icon,
}: {
  children: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-baseline justify-between">
      <h2 className="flex items-center gap-2 font-display text-xl font-bold text-white">
        {icon}
        {children}
      </h2>
      {hint && <span className="text-xs text-pitch-400">{hint}</span>}
    </div>
  );
}
