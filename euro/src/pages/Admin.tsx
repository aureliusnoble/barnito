import { useMemo, useState } from "react";
import { Clock, Dice5, Pencil, Play, RotateCcw, Trash2, Unlock, Users } from "lucide-react";
import type { EFixture, EPhase, ScorerLine } from "../types";
import { PHASES, PHASE_SHORT } from "../config";
import { useEuro } from "../store/store";
import { fmtDay, fmtFull, fmtOdds, fmtTime } from "../lib/format";
import { Btn, Modal, PageHead, SectionTitle, Stepper, TeamMark, useToast } from "../ui/kit";

export default function Admin() {
  return (
    <div className="space-y-5">
      <PageHead title="Admin" sub="Time machine, results, simulations, users. With great power…" />
      <TimeMachine />
      <Results />
      <Bulk />
      <UsersInspector />
      <Danger />
    </div>
  );
}

// ---------------------------------------------------------------------------

function TimeMachine() {
  const { state, nowMs, phaseFirstKickoff, fixtureById, adminSetSimNow } = useEuro();
  const [custom, setCustom] = useState("");
  const finalKick = fixtureById.get("final") ? Date.parse(fixtureById.get("final")!.kickoff) : nowMs;
  const presets: { label: string; at: string | null }[] = [
    { label: "Real time", at: null },
    { label: "Eve of tournament", at: new Date(phaseFirstKickoff("group") - 24 * 3600_000).toISOString() },
    { label: "Groups underway", at: new Date(phaseFirstKickoff("group") + 2 * 3600_000).toISOString() },
    { label: "R16 picks open", at: new Date(phaseFirstKickoff("r16") - 48 * 3600_000).toISOString() },
    { label: "Mid knockouts", at: new Date(phaseFirstKickoff("qf") - 24 * 3600_000).toISOString() },
    { label: "After the final", at: new Date(finalKick + 3 * 3600_000).toISOString() },
  ];
  return (
    <section className="e-card p-4">
      <SectionTitle hint={state.admin.simNow ? "simulated" : "real time"}>
        <span className="flex items-center gap-1.5"><Clock size={15} className="text-skyx-400" /> Time machine</span>
      </SectionTitle>
      <p className="mb-2 text-xs text-ink-300">
        Now: <span className="e-num font-bold text-white">{fmtFull(new Date(nowMs).toISOString())}</span>
        {state.admin.simNow && <span className="ml-1.5 e-chip bg-skyx-500/15 text-skyx-300 ring-1 ring-skyx-500/25">sim</span>}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Btn key={p.label} size="sm" onClick={() => adminSetSimNow(p.at)}>
            {p.label}
          </Btn>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className="e-input" />
        <Btn size="sm" disabled={!custom} onClick={() => adminSetSimNow(new Date(custom).toISOString())}>
          Set
        </Btn>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function Results() {
  const { state, teamById, adminSimulateFixture, adminClearResult } = useEuro();
  const { toast } = useToast();
  const [phase, setPhase] = useState<EPhase>("group");
  const [editing, setEditing] = useState<EFixture | null>(null);

  const fixtures = useMemo(
    () => state.fixtures.filter((f) => f.phase === phase).sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    [state.fixtures, phase],
  );

  return (
    <section className="e-card p-4">
      <SectionTitle>
        <span className="flex items-center gap-1.5"><Pencil size={15} className="text-volt-400" /> Results</span>
      </SectionTitle>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {PHASES.map((p) => (
          <button
            key={p}
            onClick={() => setPhase(p)}
            className={`e-chip ring-1 transition ${phase === p ? "bg-volt-400/15 text-volt-300 ring-volt-400/40" : "bg-white/[0.04] text-ink-300 ring-white/[0.06]"}`}
          >
            {PHASE_SHORT[p]}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {fixtures.map((f) => {
          const h = f.homeTeamId ? teamById.get(f.homeTeamId) : undefined;
          const a = f.awayTeamId ? teamById.get(f.awayTeamId) : undefined;
          return (
            <div key={f.id} className="flex items-center justify-between gap-2 rounded-xl bg-white/[0.03] p-2 text-xs ring-1 ring-white/[0.05]">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-ink-100">
                  {h?.name ?? f.homeLabel ?? "TBD"} <span className="text-ink-600">v</span> {a?.name ?? f.awayLabel ?? "TBD"}
                </span>
                <span className="text-[10px] text-ink-500">
                  {f.id} · {fmtDay(f.kickoff)} {fmtTime(f.kickoff)} ·{" "}
                  {f.status === "FINISHED" ? (
                    <span className="e-num font-bold text-white">
                      {f.homeGoals}–{f.awayGoals}
                      {f.penWinnerTeamId ? ` (pens ${teamById.get(f.penWinnerTeamId)?.code})` : ""}
                    </span>
                  ) : (
                    "scheduled"
                  )}
                </span>
              </span>
              <span className="flex shrink-0 gap-1">
                {h && a && f.status !== "FINISHED" && (
                  <Btn size="sm" onClick={() => adminSimulateFixture(f.id)}>
                    <Dice5 size={12} /> Sim
                  </Btn>
                )}
                {h && a && (
                  <Btn size="sm" onClick={() => setEditing(f)}>
                    <Pencil size={12} />
                  </Btn>
                )}
                {f.status === "FINISHED" && (
                  <Btn size="sm" variant="danger" onClick={() => { adminClearResult(f.id); toast("Result cleared"); }}>
                    <Trash2 size={12} />
                  </Btn>
                )}
              </span>
            </div>
          );
        })}
      </div>
      {editing && <ResultEditor fixture={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function ResultEditor({ fixture, onClose }: { fixture: EFixture; onClose: () => void }) {
  const { teamById, forwards, adminSetResult } = useEuro();
  const { toast } = useToast();
  const [hg, setHg] = useState(fixture.homeGoals ?? 0);
  const [ag, setAg] = useState(fixture.awayGoals ?? 0);
  const [penWinner, setPenWinner] = useState<string>(fixture.penWinnerTeamId ?? "");
  const [goals, setGoals] = useState<Record<string, number>>(() =>
    Object.fromEntries(fixture.scorers.map((s) => [s.playerId, s.count])),
  );

  const home = teamById.get(fixture.homeTeamId!)!;
  const away = teamById.get(fixture.awayTeamId!)!;
  const isKO = fixture.phase !== "group";
  const needsPens = isKO && hg === ag;

  const save = () => {
    const scorers: ScorerLine[] = Object.entries(goals)
      .filter(([, n]) => n > 0)
      .map(([playerId, count]) => ({ playerId, count }));
    const err = adminSetResult(fixture.id, { homeGoals: hg, awayGoals: ag, scorers, penWinnerTeamId: penWinner || null });
    if (err) toast(err, "err");
    else {
      toast("Result saved");
      onClose();
    }
  };

  const sideGoals = (teamId: string) =>
    forwards.filter((p) => p.teamId === teamId).reduce((n, p) => n + (goals[p.id] ?? 0), 0);

  return (
    <Modal
      open
      onClose={onClose}
      title={`${home.name} v ${away.name}`}
      footer={
        <>
          <Btn onClick={onClose}>Cancel</Btn>
          <Btn variant="primary" onClick={save} disabled={needsPens && !penWinner}>
            Save result
          </Btn>
        </>
      }
    >
      <div className="flex items-center justify-center gap-3">
        <TeamMark team={home} size="sm" />
        <input type="number" min={0} max={9} value={hg} onChange={(e) => setHg(Number(e.target.value))} className="e-input w-14 text-center" />
        <span className="text-ink-500">–</span>
        <input type="number" min={0} max={9} value={ag} onChange={(e) => setAg(Number(e.target.value))} className="e-input w-14 text-center" />
        <TeamMark team={away} size="sm" />
      </div>
      {needsPens && (
        <div className="flex items-center justify-center gap-2 text-sm">
          <span className="text-ink-300">Shootout winner:</span>
          <select value={penWinner} onChange={(e) => setPenWinner(e.target.value)} className="e-input w-40">
            <option value="">— pick —</option>
            <option value={home.id}>{home.name}</option>
            <option value={away.id}>{away.name}</option>
          </select>
        </div>
      )}
      {[home, away].map((t) => (
        <div key={t.id}>
          <div className="mb-1 flex items-center justify-between text-xs text-ink-400">
            <span>{t.name} scorers (forwards)</span>
            {sideGoals(t.id) > (t.id === home.id ? hg : ag) && <span className="text-amber-400">more scorer goals than team goals</span>}
          </div>
          <div className="max-h-36 space-y-1 overflow-y-auto pr-1">
            {forwards
              .filter((p) => p.teamId === t.id)
              .map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="text-ink-200">{p.name}</span>
                  <Stepper value={goals[p.id] ?? 0} min={0} max={9} onChange={(v) => setGoals((g) => ({ ...g, [p.id]: v }))} />
                </div>
              ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}

// ---------------------------------------------------------------------------

function Bulk() {
  const { adminSimulatePhase, adminSimulateAll, adminSeedDemo } = useEuro();
  const { toast } = useToast();
  return (
    <section className="e-card p-4">
      <SectionTitle>
        <span className="flex items-center gap-1.5"><Play size={15} className="text-mint-400" /> Bulk simulation</span>
      </SectionTitle>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {PHASES.map((p) => (
          <Btn key={p} size="sm" onClick={() => { adminSimulatePhase(p); toast(`Simulated ${PHASE_SHORT[p]}`); }}>
            <Dice5 size={12} /> {PHASE_SHORT[p]}
          </Btn>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Btn size="sm" onClick={() => { adminSeedDemo(); toast("Demo picks locked for everyone"); }}>
          <Users size={12} /> Seed demo picks
        </Btn>
        <Btn variant="primary" size="sm" onClick={() => { adminSimulateAll(); toast("Full tournament simulated 🎉"); }}>
          <Play size={12} /> Simulate WHOLE tournament
        </Btn>
      </div>
      <p className="mt-2 text-[11px] text-ink-500">
        "Whole tournament" locks demo picks for every player round-by-round (at each round's odds), then plays all 51 games — an instant full season for testing.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------

function UsersInspector() {
  const { state, teamById, playerById, fixtureById, adminUnlock } = useEuro();
  const { toast } = useToast();
  const [userId, setUserId] = useState(state.users.find((u) => !u.isAdmin)?.id ?? "");
  const user = state.users.find((u) => u.id === userId);
  const p = state.predictions[userId];

  const unlock = (kind: "outcome" | "scorers" | "tokens" | "champion", key?: string) => {
    adminUnlock(userId, kind, key);
    toast("Unlocked");
  };

  const lockedOutcomes = Object.entries(p?.outcomes ?? {}).filter(([, o]) => o.locked);
  const draftOutcomes = Object.entries(p?.outcomes ?? {}).filter(([, o]) => !o.locked);

  return (
    <section className="e-card p-4">
      <SectionTitle>
        <span className="flex items-center gap-1.5"><Users size={15} className="text-skyx-400" /> Users</span>
      </SectionTitle>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {state.users.map((u) => (
          <button
            key={u.id}
            onClick={() => setUserId(u.id)}
            className={`e-chip ring-1 transition ${userId === u.id ? "bg-skyx-500/15 text-skyx-300 ring-skyx-500/40" : "bg-white/[0.04] text-ink-300 ring-white/[0.06]"}`}
          >
            {u.emoji} {u.name.split(" ")[0]}
          </button>
        ))}
      </div>
      {user && p && (
        <div className="space-y-2.5 text-xs">
          <div className="flex items-center justify-between">
            <span className="text-ink-300">
              👑 Champion:{" "}
              {p.champion ? (
                <span className="text-ink-100">
                  {teamById.get(p.champion.teamId)?.name}
                  {p.champion.locked ? ` 🔒 ×${fmtOdds(p.champion.outrightOdds ?? 0)}` : " (draft)"}
                </span>
              ) : (
                "none"
              )}
            </span>
            {p.champion?.locked && (
              <Btn size="sm" variant="ghost" onClick={() => unlock("champion")}>
                <Unlock size={11} /> Unlock
              </Btn>
            )}
          </div>
          {PHASES.map((ph) => {
            const sp = p.scorers[ph];
            const tp = p.tokens[ph];
            if (!sp && !tp) return null;
            return (
              <div key={ph} className="rounded-lg bg-white/[0.03] p-2 ring-1 ring-white/[0.05]">
                <div className="mb-1 font-semibold text-ink-200">{PHASE_SHORT[ph]}</div>
                {sp && (
                  <div className="mb-1 flex items-start justify-between gap-2">
                    <span className="text-ink-300">
                      ⚽ {sp.playerIds.map((id) => playerById.get(id)?.name.split(" ").slice(-1)[0] ?? id).join(", ")}
                      {sp.locked ? " 🔒" : " (draft)"}
                    </span>
                    {sp.locked && (
                      <Btn size="sm" variant="ghost" onClick={() => unlock("scorers", ph)}>
                        <Unlock size={11} />
                      </Btn>
                    )}
                  </div>
                )}
                {tp && (
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-ink-300">
                      🪙 {tp.assigns.map((a) => `${a.count} on ${teamById.get(a.teamId)?.code}`).join(", ")}
                      {tp.locked ? " 🔒" : " (draft)"}
                    </span>
                    {tp.locked && (
                      <Btn size="sm" variant="ghost" onClick={() => unlock("tokens", ph)}>
                        <Unlock size={11} />
                      </Btn>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div>
            <div className="mb-1 text-ink-400">
              Match picks: {lockedOutcomes.length} locked · {draftOutcomes.length} drafts
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
              {lockedOutcomes.slice(0, 20).map(([fid, o]) => {
                const f = fixtureById.get(fid);
                return (
                  <div key={fid} className="flex items-center justify-between">
                    <span className="text-ink-300">
                      {f ? `${teamById.get(f.homeTeamId ?? "")?.code ?? "?"} v ${teamById.get(f.awayTeamId ?? "")?.code ?? "?"}` : fid} · {o.pick}
                      {o.odds != null && <span className="e-num text-punch-300"> ×{fmtOdds(o.odds)}</span>} 🔒
                    </span>
                    <Btn size="sm" variant="ghost" onClick={() => unlock("outcome", fid)}>
                      <Unlock size={11} />
                    </Btn>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------

function Danger() {
  const { adminReset } = useEuro();
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  return (
    <section className="e-card p-4 ring-1 ring-red-500/20">
      <SectionTitle>
        <span className="flex items-center gap-1.5"><RotateCcw size={15} className="text-red-400" /> Danger zone</span>
      </SectionTitle>
      <Btn variant="danger" size="sm" onClick={() => setOpen(true)}>
        <Trash2 size={12} /> Reset everything
      </Btn>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Reset everything?"
        footer={
          <>
            <Btn onClick={() => setOpen(false)}>Keep it</Btn>
            <Btn variant="danger" onClick={() => { adminReset(); setOpen(false); toast("Fresh slate — everything reset"); }}>
              <Trash2 size={13} /> Yes, wipe it
            </Btn>
          </>
        }
      >
        <p className="text-sm text-ink-300">
          Every prediction, lock, result and the sim clock go back to zero (accounts stay). This browser only. No undo.
        </p>
      </Modal>
    </section>
  );
}
