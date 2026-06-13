import type { Match, MatchStatus } from "@shared/types";
import { useHelpers } from "../data/store";
import { Crest } from "./visuals";

export { Crest } from "./visuals";

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
  let label: string = match.status;
  if (match.status === "LIVE") label = match.elapsed != null ? `${match.elapsed}'` : "LIVE";
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
