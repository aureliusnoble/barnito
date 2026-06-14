import { useState } from "react";
import { Trophy, ChevronDown, Target, CircleCheck, Goal, Table2, Crown, Medal, LineChart } from "lucide-react";
import { useBarnito } from "../data/store";
import ScoreChart from "../components/ScoreChart";
import type { ScoreBreakdown } from "@shared/types";

const BREAKDOWN: {
  key: keyof ScoreBreakdown;
  label: string;
  Icon: typeof Target;
  color: string;
}[] = [
  { key: "exactScores", label: "Exact scorelines", Icon: Target, color: "text-accent-400" },
  { key: "outcomes", label: "Correct results", Icon: CircleCheck, color: "text-accent-400" },
  { key: "scorers", label: "Goal scorers", Icon: Goal, color: "text-sky-400" },
  { key: "standings", label: "Group standings", Icon: Table2, color: "text-spice-400" },
  { key: "champion", label: "Champion", Icon: Crown, color: "text-yellow-400" },
];

const MEDAL = [
  "bg-gradient-to-br from-yellow-300 to-amber-500",
  "bg-gradient-to-br from-zinc-200 to-zinc-400",
  "bg-gradient-to-br from-amber-600 to-amber-800",
];

function RankBadge({ rank }: { rank: number }) {
  if (rank <= 3) {
    return (
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-pitch-950 shadow ${MEDAL[rank - 1]}`}>
        <Medal size={18} strokeWidth={2.5} />
      </span>
    );
  }
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-pitch-800 font-display text-sm font-bold text-pitch-300">
      {rank}
    </span>
  );
}

export default function Leaderboard() {
  const { scores } = useBarnito();
  const [open, setOpen] = useState<string | null>(scores.leaderboard[0]?.participantId ?? null);
  const [chart, setChart] = useState(false);
  const top = scores.leaderboard[0]?.total || 1;

  return (
    <div className="space-y-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="flex items-center gap-2 font-display text-xl font-bold text-white">
          <Trophy size={18} className="text-accent-400" /> Leaderboard
        </h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-pitch-400">{scores.leaderboard.length} players</span>
          <button
            onClick={() => setChart(true)}
            title="Points over time"
            className="grid h-9 w-9 place-items-center rounded-full bg-pitch-800 text-pitch-300 ring-1 ring-white/10 transition hover:text-accent-300"
          >
            <LineChart size={17} />
          </button>
        </div>
      </div>
      {chart && <ScoreChart onClose={() => setChart(false)} />}
      <div className="space-y-2">
        {scores.leaderboard.map((entry) => {
          const isOpen = open === entry.participantId;
          const pct = Math.max(4, Math.round((entry.total / top) * 100));
          return (
            <div
              key={entry.participantId}
              className={`card overflow-hidden transition ${isOpen ? "ring-1 ring-accent-500/20" : ""}`}
            >
              <button
                onClick={() => setOpen(isOpen ? null : entry.participantId)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <RankBadge rank={entry.rank} />
                <div className="min-w-0 flex-1">
                  <div className="font-display text-base font-bold text-white">{entry.name}</div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-pitch-800">
                    <div
                      className="h-full origin-left animate-bar-grow rounded-full bg-gradient-to-r from-accent-600 to-accent-400"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                <span className="font-display text-xl font-extrabold tabular-nums text-white">
                  {entry.total}
                </span>
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-pitch-500 transition ${isOpen ? "rotate-180" : ""}`}
                />
              </button>
              {isOpen && (
                <div className="grid grid-cols-2 gap-px border-t border-white/[0.06] bg-white/[0.02] p-2">
                  {BREAKDOWN.map((b) => (
                    <div
                      key={b.key}
                      className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm"
                    >
                      <span className="flex items-center gap-2 text-pitch-300">
                        <b.Icon size={15} className={b.color} strokeWidth={2.2} />
                        {b.label}
                      </span>
                      <span className="font-mono tabular-nums text-pitch-100">
                        {entry.breakdown[b.key]}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="px-1 text-xs text-pitch-500">
        Points lock in at full time — live games don't count yet. Champion (+250) is awarded at the
        end; group-standings points lock once each group finishes.
      </p>
    </div>
  );
}
