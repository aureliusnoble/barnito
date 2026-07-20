import { useMemo, useState } from "react";
import { Lock } from "lucide-react";
import type { EGroup, EPhase } from "../types";
import { PHASES, PHASE_LABEL, PHASE_SHORT } from "../config";
import { useEuro } from "../store/store";
import { Btn, CountdownPill, Modal, PageHead, Tabs, useToast } from "../ui/kit";
import { fmtFull } from "../lib/format";
import MatchPredictCard from "../components/MatchPredictCard";

const GROUPS: (EGroup | "ALL")[] = ["ALL", "A", "B", "C", "D", "E", "F"];

export default function Matches() {
  const { me, state, nowMs, phaseFirstKickoff, phaseTeamsKnown, canPredictFixture, lockAllOutcomes } = useEuro();
  const { toast } = useToast();
  const [phase, setPhase] = useState<EPhase>("group");
  const [group, setGroup] = useState<EGroup | "ALL">("ALL");
  const [confirmAll, setConfirmAll] = useState(false);

  const fixtures = useMemo(
    () =>
      state.fixtures
        .filter((f) => f.phase === phase && (phase !== "group" || group === "ALL" || f.group === group))
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id)),
    [state.fixtures, phase, group],
  );

  const deadline = phaseFirstKickoff(phase);
  const roundOpen = phaseTeamsKnown(phase) && nowMs < deadline;
  const myOutcomes = me ? state.predictions[me.id]?.outcomes ?? {} : {};
  const phaseFixtures = state.fixtures.filter((f) => f.phase === phase);
  const drafts = phaseFixtures.filter((f) => canPredictFixture(f) && myOutcomes[f.id] && !myOutcomes[f.id].locked).length;
  const unpicked = phaseFixtures.filter((f) => canPredictFixture(f) && !myOutcomes[f.id]).length;

  const doLockAll = () => {
    const err = lockAllOutcomes(phase);
    if (err) toast(err, "err");
    else toast(`${drafts} pick${drafts === 1 ? "" : "s"} locked 🔒`);
    setConfirmAll(false);
  };

  return (
    <div className="space-y-4">
      <PageHead title="Matches" sub={`${PHASE_LABEL[phase]} — pick every result, lock before the round kicks off.`} />
      <Tabs options={PHASES.map((p) => ({ value: p, label: PHASE_SHORT[p] }))} value={phase} onChange={setPhase} />

      {/* round deadline */}
      <div className="e-card flex flex-wrap items-center justify-between gap-2 p-3">
        {roundOpen ? (
          <>
            <span className="text-xs text-ink-300">
              All {PHASE_SHORT[phase]} picks lock at the round's first kickoff
              {unpicked > 0 && <span className="block text-[11px] text-amber-400">{unpicked} game{unpicked === 1 ? "" : "s"} still need a pick</span>}
            </span>
            <span className="flex items-center gap-2">
              <span className="hidden text-[11px] text-ink-400 sm:block">{fmtFull(new Date(deadline).toISOString())}</span>
              <CountdownPill toIso={new Date(deadline).toISOString()} nowMs={nowMs} />
              {drafts > 0 && (
                <Btn variant="primary" size="sm" onClick={() => setConfirmAll(true)}>
                  <Lock size={12} /> Lock all {drafts}
                </Btn>
              )}
            </span>
          </>
        ) : (
          <span className="text-xs text-ink-400">
            {phaseTeamsKnown(phase) ? "This round's picks are locked — kickoff has passed." : "Opens once the round's teams are set."}
          </span>
        )}
      </div>
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

      <Modal
        open={confirmAll}
        onClose={() => setConfirmAll(false)}
        title={`Lock all ${drafts} remaining picks?`}
        footer={
          <>
            <Btn onClick={() => setConfirmAll(false)}>Not yet</Btn>
            <Btn variant="primary" onClick={doLockAll}>
              <Lock size={14} /> Lock them all
            </Btn>
          </>
        }
      >
        <p className="text-sm text-ink-300">
          Every drafted {PHASE_SHORT[phase]} pick locks at today's odds, permanently. Games without a pick stay open until the deadline.
        </p>
      </Modal>
    </div>
  );
}
