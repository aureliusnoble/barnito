import { useState } from "react";
import { useBarnito } from "../data/store";
import { SectionTitle } from "../components/bits";
import type { ScoreBreakdown } from "@shared/types";

const BREAKDOWN: { key: keyof ScoreBreakdown; label: string; icon: string }[] = [
  { key: "exactScores", label: "Exact scorelines", icon: "🎯" },
  { key: "outcomes", label: "Correct results", icon: "✅" },
  { key: "scorers", label: "Goal scorers", icon: "⚽" },
  { key: "standings", label: "Group standings", icon: "📊" },
  { key: "champion", label: "Champion", icon: "👑" },
];

const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null);

export default function Leaderboard() {
  const { scores } = useBarnito();
  const [open, setOpen] = useState<string | null>(scores.leaderboard[0]?.participantId ?? null);

  return (
    <div className="space-y-4">
      <SectionTitle hint={`${scores.leaderboard.length} players`}>Leaderboard</SectionTitle>
      <div className="space-y-2">
        {scores.leaderboard.map((entry) => {
          const isOpen = open === entry.participantId;
          return (
            <div key={entry.participantId} className="card overflow-hidden">
              <button
                onClick={() => setOpen(isOpen ? null : entry.participantId)}
                className="flex w-full items-center gap-3 p-3 text-left"
              >
                <span className="flex w-8 shrink-0 justify-center font-display text-lg font-bold text-pitch-300">
                  {medal(entry.rank) ?? entry.rank}
                </span>
                <span className="flex-1 font-display text-base font-bold">{entry.name}</span>
                <span className="font-display text-xl font-extrabold tabular-nums text-pitch-100">
                  {entry.total}
                </span>
                <span className={`text-pitch-500 transition ${isOpen ? "rotate-180" : ""}`}>▾</span>
              </button>
              {isOpen && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-pitch-800/60 bg-pitch-950/40 p-3 text-sm">
                  {BREAKDOWN.map((b) => (
                    <div key={b.key} className="flex items-center justify-between">
                      <span className="text-pitch-300">
                        {b.icon} {b.label}
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
        Live matches contribute provisional points. Champion (+250) is awarded at the end of the
        tournament; group-standings points lock once each group is finished.
      </p>
    </div>
  );
}
