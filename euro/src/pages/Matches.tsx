import { useMemo, useState } from "react";
import type { EGroup, EPhase } from "../types";
import { PHASES, PHASE_LABEL, PHASE_SHORT } from "../config";
import { useEuro } from "../store/store";
import { PageHead, Tabs } from "../ui/kit";
import MatchPredictCard from "../components/MatchPredictCard";

const GROUPS: (EGroup | "ALL")[] = ["ALL", "A", "B", "C", "D", "E", "F"];

export default function Matches() {
  const { state } = useEuro();
  const [phase, setPhase] = useState<EPhase>("group");
  const [group, setGroup] = useState<EGroup | "ALL">("ALL");

  const fixtures = useMemo(
    () =>
      state.fixtures
        .filter((f) => f.phase === phase && (phase !== "group" || group === "ALL" || f.group === group))
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id)),
    [state.fixtures, phase, group],
  );

  return (
    <div className="space-y-4">
      <PageHead title="Matches" sub={`${PHASE_LABEL[phase]} — pick the result, lock your odds.`} />
      <Tabs options={PHASES.map((p) => ({ value: p, label: PHASE_SHORT[p] }))} value={phase} onChange={setPhase} />
      {phase === "group" && (
        <div className="flex flex-wrap gap-1.5">
          {GROUPS.map((g) => (
            <button
              key={g}
              onClick={() => setGroup(g)}
              className={`e-chip ring-1 transition ${
                group === g ? "bg-volt-400/15 text-volt-300 ring-volt-400/40" : "bg-white/[0.04] text-ink-300 ring-white/[0.06] hover:text-white"
              }`}
            >
              {g === "ALL" ? "All groups" : `Group ${g}`}
            </button>
          ))}
        </div>
      )}
      <div className="space-y-2.5">
        {fixtures.map((f) => (
          <MatchPredictCard key={f.id} fixture={f} />
        ))}
      </div>
    </div>
  );
}
