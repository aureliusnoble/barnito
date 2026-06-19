import { useMemo, useState } from "react";
import { Table2 } from "lucide-react";
import { useBarnito, useHelpers } from "../data/store";
import { SectionTitle, Crest } from "../components/bits";
import { POINTS_PER_CORRECT_STANDING } from "@shared/constants";
import type { GroupStanding } from "@shared/types";

type Result = "W" | "D" | "L";
const firstName = (n: string) => n.split(" ")[0];

export default function Groups() {
  const { standings, scores, predictions, matches } = useBarnito();
  const [who, setWho] = useState<string>("");

  // recent form per team from finished matches (chronological, last 3)
  const formByTeam = useMemo(() => {
    const map = new Map<string, Result[]>();
    const finished = matches.matches
      .filter((m) => m.status === "FINISHED" && m.homeGoals != null && m.awayGoals != null)
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff));
    for (const m of finished) {
      const hr: Result = m.homeGoals! > m.awayGoals! ? "W" : m.homeGoals! < m.awayGoals! ? "L" : "D";
      const ar: Result = hr === "W" ? "L" : hr === "L" ? "W" : "D";
      (map.get(m.homeTeamId) ?? map.set(m.homeTeamId, []).get(m.homeTeamId)!).push(hr);
      (map.get(m.awayTeamId) ?? map.set(m.awayTeamId, []).get(m.awayTeamId)!).push(ar);
    }
    return map;
  }, [matches]);

  // Standings points each user currently scores per group: 25 × correctly-placed teams in the live
  // table (provisional until the group is final, then locked). Only users with > 0 are shown.
  const pointsByGroup = useMemo(() => {
    const out = new Map<string, { name: string; points: number }[]>();
    for (const g of standings.groups) {
      const order = g.rows.map((r) => r.teamId);
      const list: { name: string; points: number }[] = [];
      for (const ps of scores.predictedStandings) {
        const pg = ps.groups.find((x) => x.group === g.group);
        if (!pg) continue;
        let correct = 0;
        for (let i = 0; i < pg.orderedTeamIds.length; i++) if (pg.orderedTeamIds[i] === order[i]) correct++;
        const points = correct * POINTS_PER_CORRECT_STANDING;
        if (points > 0) list.push({ name: ps.name, points });
      }
      list.sort((a, b) => b.points - a.points || a.name.localeCompare(b.name));
      out.set(g.group, list);
    }
    return out;
  }, [standings, scores.predictedStandings]);

  const predForWho = who && scores.predictedStandings.find((p) => p.participantId === who);

  return (
    <div className="space-y-4">
      <SectionTitle icon={<Table2 size={18} className="text-accent-400" />} hint="actual tables">
        Groups
      </SectionTitle>

      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-pitch-400">Overlay prediction</span>
        <select
          value={who}
          onChange={(e) => setWho(e.target.value)}
          className="rounded-lg border border-white/10 bg-pitch-900 px-2 py-1 text-sm text-pitch-100"
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
            formByTeam={formByTeam}
            board={pointsByGroup.get(g.group) ?? []}
            predicted={predForWho ? predForWho.groups.find((x) => x.group === g.group) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function FormDots({ form }: { form: Result[] }) {
  const color = { W: "bg-accent-500", D: "bg-pitch-500", L: "bg-red-500" };
  return (
    <span className="flex gap-0.5">
      {form.slice(-3).map((r, i) => (
        <span key={i} className={`h-1.5 w-1.5 rounded-full ${color[r]}`} title={r} />
      ))}
    </span>
  );
}

function GroupTable({
  g,
  formByTeam,
  board,
  predicted,
}: {
  g: GroupStanding;
  formByTeam: Map<string, Result[]>;
  board: { name: string; points: number }[];
  predicted?: { orderedTeamIds: string[]; correctPositions: number; points: number; counted: boolean };
}) {
  const { teamName } = useHelpers();
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
        <h3 className="font-display font-bold text-white">Group {g.group}</h3>
        <span
          className={`chip ${g.final ? "bg-pitch-700 text-pitch-300" : "bg-spice-500/20 text-spice-300"}`}
        >
          {g.final ? "Final" : "In progress"}
        </span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-[10px] uppercase tracking-wide text-pitch-500">
            <th className="py-1.5 pl-3 text-left font-semibold">#</th>
            <th className="py-1.5 text-left font-semibold">Team</th>
            <th className="px-1 py-1.5 text-center font-semibold">Pld</th>
            <th className="px-1 py-1.5 text-center font-semibold">GD</th>
            <th className="px-2 py-1.5 text-center font-semibold">Pts</th>
            <th className="hidden py-1.5 pr-3 text-center font-semibold sm:table-cell">Form</th>
          </tr>
        </thead>
        <tbody>
          {g.rows.map((r) => {
            const qualifies = r.pos <= 2;
            return (
              <tr
                key={r.teamId}
                className={`border-t border-white/[0.04] ${qualifies ? "bg-accent-500/[0.06]" : ""}`}
              >
                <td className="relative py-2 pl-3 text-pitch-400">
                  {qualifies && <span className="absolute left-0 top-1.5 h-[calc(100%-12px)] w-0.5 rounded-full bg-accent-500" />}
                  <span className={qualifies ? "font-semibold text-white" : ""}>{r.pos}</span>
                </td>
                <td className="py-2">
                  <span className="flex items-center gap-2">
                    <Crest teamId={r.teamId} size={18} />
                    <span className="truncate text-pitch-100">{teamName(r.teamId)}</span>
                  </span>
                </td>
                <td className="px-1 py-2 text-center tabular-nums text-pitch-400">{r.played}</td>
                <td className="px-1 py-2 text-center tabular-nums text-pitch-400">
                  {r.gd > 0 ? `+${r.gd}` : r.gd}
                </td>
                <td className="px-2 py-2 text-center font-bold tabular-nums text-white">{r.points}</td>
                <td className="hidden py-2 pr-3 sm:table-cell">
                  <span className="flex justify-center">
                    <FormDots form={formByTeam.get(r.teamId) ?? []} />
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {board.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] px-3 py-2">
          <span className="mr-0.5 text-[10px] font-semibold uppercase tracking-wide text-pitch-500">
            {g.final ? "Standings · locked" : "Standings · live"}
          </span>
          {board.map((b) => (
            <span
              key={b.name}
              title={`${b.name} — ${b.points} standings points${g.final ? "" : " (provisional)"}`}
              className={`chip gap-1 ${g.final ? "bg-accent-500/20 text-accent-300" : "bg-spice-500/15 text-spice-300"}`}
            >
              {firstName(b.name)} <span className="font-bold tabular-nums">+{b.points}</span>
            </span>
          ))}
        </div>
      )}

      {predicted && (
        <div className="border-t border-white/[0.06] bg-pitch-950/40 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-pitch-400">Predicted order</span>
            {predicted.counted ? (
              <span className="font-semibold text-pitch-200">
                {predicted.correctPositions}/4 correct
                {predicted.points > 0 && (
                  <span className="ml-1 text-accent-300">(+{predicted.points})</span>
                )}
              </span>
            ) : (
              <span className="text-pitch-500">pending group finish</span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {predicted.orderedTeamIds.map((tid, i) => {
              const correct = predicted.counted && g.rows[i]?.teamId === tid;
              return (
                <span
                  key={tid}
                  className={`chip ${
                    correct ? "bg-accent-500/25 text-accent-200" : "bg-pitch-800/70 text-pitch-300"
                  }`}
                >
                  {i + 1}. <Crest teamId={tid} size={13} /> {teamName(tid)}
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
