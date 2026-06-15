import { Target, Flame } from "lucide-react";
import type { Match, MatchStatus } from "@shared/types";
import { useBarnito, useHelpers } from "../data/store";
import { useTick, liveMinute } from "../lib/clock";
import { Crest } from "./visuals";

export { Crest } from "./visuals";

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
 * Small tags flagging that a participant has one of their six chosen scorers playing for a team in
 * this match — i.e. a reason to tune in. Membership only (no lineup needed): the player just has to
 * belong to one of the two nations. Returns null when nobody has a pick on either side.
 */
export function ScorerPickTags({ match, className = "" }: { match: Match; className?: string }) {
  const { predictions, playerById } = useBarnito();
  const { teamName } = useHelpers();
  const teamIds = new Set([match.homeTeamId, match.awayTeamId]);
  const picks: { key: string; participant: string; playerName: string; teamId: string }[] = [];
  for (const part of predictions.participants) {
    for (const pid of part.topPlayers) {
      const pl = playerById.get(pid);
      if (pl && teamIds.has(pl.teamId)) {
        picks.push({ key: `${part.id}-${pid}`, participant: part.name, playerName: pl.name, teamId: pl.teamId });
      }
    }
  }
  if (picks.length === 0) return null;
  return (
    <div className={`flex flex-wrap items-center gap-1 ${className}`}>
      <Target size={11} className="shrink-0 text-accent-400" />
      {picks.map((p) => (
        <span
          key={p.key}
          title={`${p.participant}: ${p.playerName} (${teamName(p.teamId)})`}
          className="chip gap-1 bg-accent-500/15 px-1.5 py-0.5 text-[10px] text-accent-300"
        >
          <Crest teamId={p.teamId} size={10} />
          {p.participant}
        </span>
      ))}
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
