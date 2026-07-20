import { useMemo, useState } from "react";
import type { EGroup } from "../types";
import { useEuro, groupsComplete, winnerOf } from "../store/store";
import { groupTable, bestThirds, groupComplete } from "../lib/table";
import { fmtDay, fmtTime } from "../lib/format";
import { PageHead, SectionTitle, TeamMark } from "../ui/kit";

const GROUPS: EGroup[] = ["A", "B", "C", "D", "E", "F"];
const KO_ROUNDS: { title: string; ids: string[] }[] = [
  { title: "Round of 16", ids: ["r16-1", "r16-2", "r16-3", "r16-4", "r16-5", "r16-6", "r16-7", "r16-8"] },
  { title: "Quarter-finals", ids: ["qf-1", "qf-2", "qf-3", "qf-4"] },
  { title: "Semi-finals", ids: ["sf-1", "sf-2"] },
  { title: "Final", ids: ["final"] },
];

export default function Tournament() {
  const { state, teams, teamById, fixtureById } = useEuro();
  const [group, setGroup] = useState<EGroup>("A");

  const table = useMemo(() => groupTable(group, state.fixtures, teams), [group, state.fixtures, teams]);
  const complete = groupComplete(group, state.fixtures);
  const allDone = groupsComplete(state.fixtures);
  const thirds = useMemo(
    () => (allDone ? new Set(bestThirds(state.fixtures, teams).map((t) => t.teamId)) : new Set<string>()),
    [allDone, state.fixtures, teams],
  );
  const groupFixtures = state.fixtures
    .filter((f) => f.phase === "group" && f.group === group)
    .sort((a, b) => a.kickoff.localeCompare(b.kickoff));

  const finalFixture = fixtureById.get("final");
  const champion = finalFixture ? winnerOf(finalFixture) : null;

  return (
    <div className="space-y-5">
      <PageHead title="Tournament" sub="Group tables and the road to Wembley — results only, no predictions here." />

      {champion && (
        <div className="e-card p-4 text-center ring-1 ring-volt-400/30 shadow-glow">
          <div className="text-4xl">{teamById.get(champion)?.flag} 🏆</div>
          <div className="mt-1 font-grotesk text-xl font-extrabold text-white">{teamById.get(champion)?.name} are champions of Europe</div>
        </div>
      )}

      {/* groups */}
      <section>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={`e-chip ring-1 transition ${group === g ? "bg-volt-400/15 text-volt-300 ring-volt-400/40" : "bg-white/[0.04] text-ink-300 ring-white/[0.06] hover:text-white"}`}
            >
              Group {g}
            </button>
          ))}
        </div>
        <div className="e-card overflow-x-auto p-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wide text-ink-500">
                <th className="pb-1.5 pr-2 font-semibold">#</th>
                <th className="pb-1.5 font-semibold">Team</th>
                {["P", "W", "D", "L", "GF", "GA", "GD", "Pts"].map((h) => (
                  <th key={h} className="pb-1.5 pl-2 text-right font-semibold">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.map((r) => {
                const qualified = complete && r.pos <= 2;
                const third = allDone && thirds.has(r.teamId);
                return (
                  <tr key={r.teamId} className={qualified ? "bg-volt-400/[0.06]" : third ? "bg-skyx-500/[0.08]" : ""}>
                    <td className="e-num py-1.5 pr-2 text-ink-400">{r.pos}</td>
                    <td className="py-1.5"><TeamMark team={teamById.get(r.teamId)} size="sm" /></td>
                    {[r.played, r.won, r.drawn, r.lost, r.gf, r.ga, r.gd, r.points].map((v, i) => (
                      <td key={i} className={`e-num py-1.5 pl-2 text-right ${i === 7 ? "font-bold text-white" : "text-ink-300"}`}>{v}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-2 text-[10px] text-ink-500">
            <span className="text-volt-300">■</span> top two qualify · <span className="text-skyx-300">■</span> best-third qualifier
            {!complete && " · table live until all six games finish"}
          </p>
        </div>
        <div className="mt-2 space-y-1">
          {groupFixtures.map((f) => (
            <div key={f.id} className="e-card flex items-center justify-between p-2.5 text-xs">
              <span className="flex min-w-0 items-center gap-1.5 text-ink-200">
                <TeamMark team={f.homeTeamId ? teamById.get(f.homeTeamId) : undefined} size="sm" />
                <span className="text-ink-600">v</span>
                <TeamMark team={f.awayTeamId ? teamById.get(f.awayTeamId) : undefined} size="sm" />
              </span>
              {f.status === "FINISHED" ? (
                <span className="e-num font-grotesk font-bold text-white">
                  {f.homeGoals}–{f.awayGoals}
                </span>
              ) : (
                <span className="e-num text-ink-400">
                  {fmtDay(f.kickoff)} {fmtTime(f.kickoff)}
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* knockout */}
      {KO_ROUNDS.map((round) => (
        <section key={round.title}>
          <SectionTitle>{round.title}</SectionTitle>
          <div className="space-y-1.5">
            {round.ids.map((id) => {
              const f = fixtureById.get(id);
              if (!f) return null;
              const w = winnerOf(f);
              const side = (teamId: string | null, label: string | undefined, goals: number | null) => {
                const t = teamId ? teamById.get(teamId) : undefined;
                const isW = !!w && w === teamId;
                return (
                  <div className="flex items-center justify-between">
                    {t ? (
                      <span className={isW ? "" : f.status === "FINISHED" ? "opacity-50" : ""}>
                        <TeamMark team={t} size="sm" />
                      </span>
                    ) : (
                      <span className="text-xs text-ink-500">{label ?? "TBD"}</span>
                    )}
                    {goals != null && <span className={`e-num font-grotesk font-bold ${isW ? "text-white" : "text-ink-400"}`}>{goals}</span>}
                  </div>
                );
              };
              return (
                <div key={id} className="e-card p-2.5">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-ink-500">
                    <span>
                      {fmtDay(f.kickoff)} · {fmtTime(f.kickoff)} · {f.venue}
                    </span>
                    {f.penWinnerTeamId && <span className="text-punch-300">pens: {teamById.get(f.penWinnerTeamId)?.code}</span>}
                  </div>
                  <div className="space-y-1">{side(f.homeTeamId, f.homeLabel, f.homeGoals)}{side(f.awayTeamId, f.awayLabel, f.awayGoals)}</div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
