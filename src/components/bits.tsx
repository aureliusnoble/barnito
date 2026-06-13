import type { Match, MatchStatus } from "@shared/types";
import { useHelpers } from "../data/store";
import { flagEmoji } from "../lib/format";

export function Flag({ teamId, className = "" }: { teamId: string; className?: string }) {
  const { teamName } = useHelpers();
  return (
    <span className={className} aria-hidden>
      {flagEmoji(teamName(teamId))}
    </span>
  );
}

export function TeamLabel({
  teamId,
  align = "left",
  className = "",
}: {
  teamId: string;
  align?: "left" | "right";
  className?: string;
}) {
  const { teamName } = useHelpers();
  return (
    <span
      className={`flex min-w-0 items-center gap-1.5 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      } ${className}`}
    >
      <span className="text-lg leading-none">{flagEmoji(teamName(teamId))}</span>
      <span className="truncate">{teamName(teamId)}</span>
    </span>
  );
}

const STATUS_STYLE: Record<MatchStatus, string> = {
  SCHEDULED: "bg-pitch-800 text-pitch-300",
  LIVE: "bg-red-500/90 text-white",
  HT: "bg-amber-500/90 text-black",
  FINISHED: "bg-pitch-700 text-pitch-200",
};

export function StatusBadge({ match }: { match: Match }) {
  let label: string = match.status;
  if (match.status === "LIVE") label = match.elapsed != null ? `${match.elapsed}'` : "LIVE";
  if (match.status === "HT") label = "HT";
  if (match.status === "FINISHED") label = "FT";
  if (match.status === "SCHEDULED") label = "—";
  return (
    <span
      className={`chip ${STATUS_STYLE[match.status]} ${
        match.status === "LIVE" ? "animate-pulse" : ""
      }`}
    >
      {match.status === "LIVE" && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
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
  if (points <= 0)
    return <span className="chip bg-pitch-800/70 text-pitch-400">0</span>;
  return (
    <span
      className={`chip ${
        provisional ? "bg-amber-500/20 text-amber-300" : "bg-pitch-600/30 text-pitch-100"
      }`}
      title={provisional ? "Provisional — match still in progress" : undefined}
    >
      +{points}
      {provisional && "*"}
    </span>
  );
}

export function GroupPill({ group }: { group: string }) {
  return (
    <span className="chip bg-pitch-800/80 text-pitch-300">Grp {group}</span>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-2 mt-1 flex items-baseline justify-between">
      <h2 className="font-display text-lg font-bold text-pitch-50">{children}</h2>
      {hint && <span className="text-xs text-pitch-400">{hint}</span>}
    </div>
  );
}
