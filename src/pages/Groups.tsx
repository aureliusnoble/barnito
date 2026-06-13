import { useState } from "react";
import { useBarnito, useHelpers } from "../data/store";
import { Flag, SectionTitle } from "../components/bits";
import { flagEmoji } from "../lib/format";
import type { GroupStanding } from "@shared/types";

export default function Groups() {
  const { standings, scores, predictions } = useBarnito();
  const [who, setWho] = useState<string>("");

  const predForWho =
    who && scores.predictedStandings.find((p) => p.participantId === who);

  return (
    <div className="space-y-4">
      <SectionTitle hint="actual tables">Groups</SectionTitle>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-pitch-400">Overlay prediction</span>
        <select
          value={who}
          onChange={(e) => setWho(e.target.value)}
          className="rounded-lg border border-pitch-700 bg-pitch-900 px-2 py-1 text-sm text-pitch-100"
        >
          <option value="">— none —</option>
          {predictions.participants.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {standings.groups.map((g) => (
          <GroupTable
            key={g.group}
            g={g}
            predicted={
              predForWho ? predForWho.groups.find((x) => x.group === g.group) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function GroupTable({
  g,
  predicted,
}: {
  g: GroupStanding;
  predicted?: { orderedTeamIds: string[]; correctPositions: number; points: number; counted: boolean };
}) {
  const { teamName } = useHelpers();
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-pitch-800/60 px-3 py-2">
        <h3 className="font-display font-bold">Group {g.group}</h3>
        <span
          className={`chip ${g.final ? "bg-pitch-700 text-pitch-200" : "bg-amber-500/20 text-amber-300"}`}
        >
          {g.final ? "Final" : "In progress"}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-pitch-500">
            <th className="py-1 pl-3 text-left font-semibold">#</th>
            <th className="py-1 text-left font-semibold">Team</th>
            <th className="px-1 py-1 text-center font-semibold">P</th>
            <th className="px-1 py-1 text-center font-semibold">GD</th>
            <th className="px-1 py-1 text-center font-semibold">Pts</th>
          </tr>
        </thead>
        <tbody>
          {g.rows.map((r) => {
            const qualifies = r.pos <= 2;
            return (
              <tr
                key={r.teamId}
                className={`border-t border-pitch-800/40 ${qualifies ? "bg-pitch-800/20" : ""}`}
              >
                <td className="py-1.5 pl-3 text-pitch-400">
                  <span className={qualifies ? "text-pitch-100" : ""}>{r.pos}</span>
                </td>
                <td className="py-1.5">
                  <span className="flex items-center gap-1.5">
                    <Flag teamId={r.teamId} className="text-base leading-none" />
                    <span className="truncate">{teamName(r.teamId)}</span>
                  </span>
                </td>
                <td className="px-1 py-1.5 text-center tabular-nums text-pitch-300">{r.played}</td>
                <td className="px-1 py-1.5 text-center tabular-nums text-pitch-300">
                  {r.gd > 0 ? `+${r.gd}` : r.gd}
                </td>
                <td className="px-1 py-1.5 text-center font-bold tabular-nums">{r.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {predicted && (
        <div className="border-t border-pitch-800/60 bg-pitch-950/40 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-pitch-400">Predicted order</span>
            {predicted.counted ? (
              <span className="font-semibold text-pitch-200">
                {predicted.correctPositions}/4 correct
                {predicted.points > 0 && (
                  <span className="ml-1 text-pitch-100">(+{predicted.points})</span>
                )}
              </span>
            ) : (
              <span className="text-pitch-500">pending group finish</span>
            )}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {predicted.orderedTeamIds.map((tid, i) => {
              const correct = predicted.counted && g.rows[i]?.teamId === tid;
              return (
                <span
                  key={tid}
                  className={`chip ${
                    correct ? "bg-pitch-600/40 text-pitch-50" : "bg-pitch-800/70 text-pitch-300"
                  }`}
                >
                  {i + 1}. {flagEmoji(teamName(tid))} {teamName(tid)}
                  {correct && " ✓"}
                </span>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
