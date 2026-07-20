import { useMemo, useState } from "react";
import { Lock, Search, X } from "lucide-react";
import type { EPhase } from "../types";
import { PHASES, PHASE_LABEL, PHASE_SHORT, SCORER_MULT, SCORER_PICKS } from "../config";
import { useEuro } from "../store/store";
import { scorerPointsPerGoal } from "../lib/scoring";
import { fmtFull, fmtProb, fmtPts } from "../lib/format";
import { Btn, CountdownPill, EmptyState, LockBadge, Modal, PageHead, ProbBar, PtsTag, SectionTitle, Tabs, TeamMark, useToast } from "../ui/kit";

export default function Scorers() {
  const euro = useEuro();
  const { me, state, nowMs, forwards, teamById, playerById, phaseFirstKickoff, phaseTeamsKnown, canLockPhase, revealPhase, scorerOddsFor, setScorerDraft, lockScorers, scoreOf } = euro;
  const { toast } = useToast();
  const [phase, setPhase] = useState<EPhase>("group");
  const [q, setQ] = useState("");
  const [teamFilter, setTeamFilter] = useState("ALL");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const limit = SCORER_PICKS[phase];
  const my = me ? state.predictions[me.id]?.scorers[phase] : undefined;
  const picked = my?.playerIds ?? [];
  const open = canLockPhase(phase) && !my?.locked;
  const teamsKnown = phaseTeamsKnown(phase);

  // Only forwards whose team is actually in this phase.
  const phaseTeamIds = useMemo(() => {
    const set = new Set<string>();
    for (const f of state.fixtures.filter((x) => x.phase === phase)) {
      if (f.homeTeamId) set.add(f.homeTeamId);
      if (f.awayTeamId) set.add(f.awayTeamId);
    }
    return set;
  }, [state.fixtures, phase]);

  const pool = useMemo(() => {
    if (!teamsKnown) return [];
    return forwards
      .filter((p) => phaseTeamIds.has(p.teamId))
      .filter((p) => teamFilter === "ALL" || p.teamId === teamFilter)
      .filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
      .map((p) => ({ p, o: scorerOddsFor(p, phase) }))
      .sort((a, b) => b.o.prob - a.o.prob);
  }, [forwards, phaseTeamIds, teamFilter, q, teamsKnown, scorerOddsFor, phase]);

  const toggle = (pid: string) => {
    const next = picked.includes(pid) ? picked.filter((x) => x !== pid) : [...picked, pid];
    const err = setScorerDraft(phase, next);
    if (err) toast(err, "err");
  };

  const doLock = () => {
    const err = lockScorers(phase);
    if (err) toast(err, "err");
    else toast("Scorer picks locked 🔒");
    setConfirmOpen(false);
  };

  const myLines = me ? (scoreOf(me.id)?.scorerLines ?? []).filter((l) => l.phase === phase) : [];

  return (
    <div className="space-y-4 pb-16">
      <PageHead title="Scorers" sub="Forwards only. Every goal pays their per-goal odds × round multiplier — priced so every pick's expected return is identical. Braces pay double." />
      <Tabs options={PHASES.map((p) => ({ value: p, label: PHASE_SHORT[p] }))} value={phase} onChange={setPhase} />

      {/* status */}
      <div className="e-card flex flex-wrap items-center justify-between gap-2 p-3.5">
        <span className="flex items-center gap-2 text-sm">
          <span className="e-num font-grotesk text-lg font-extrabold text-white">
            {picked.length}<span className="text-ink-500">/{limit}</span>
          </span>
          <span className="text-ink-300">picks</span>
          <span className="e-chip bg-punch-500/15 text-punch-300 ring-1 ring-punch-500/25">×{SCORER_MULT[phase]} round</span>
          {my?.locked && <LockBadge lockedAt={my.lockedAt} />}
        </span>
        <span className="flex items-center gap-2 text-[11px] text-ink-400">
          {teamsKnown ? (
            <>
              locks {fmtFull(new Date(phaseFirstKickoff(phase)).toISOString())} <CountdownPill toIso={new Date(phaseFirstKickoff(phase)).toISOString()} nowMs={nowMs} />
            </>
          ) : (
            "Opens once the round's teams are set"
          )}
        </span>
      </div>

      {/* locked view */}
      {my?.locked && (
        <div className="space-y-1.5">
          <SectionTitle hint={PHASE_LABEL[phase]}>Your locked picks</SectionTitle>
          {my.playerIds.map((pid) => {
            const p = playerById.get(pid);
            const odds = my.oddsByPlayer?.[pid] ?? 0;
            const line = myLines.find((l) => l.playerId === pid);
            return (
              <div key={pid} className="e-card flex items-center justify-between gap-2 p-3">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-white">{p?.name ?? pid}</span>
                  <TeamMark team={p && teamById.get(p.teamId)} size="sm" muted />
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="e-num text-[11px] text-ink-400">+{fmtPts(scorerPointsPerGoal(phase, odds))}/goal</span>
                  {line && line.goals > 0 ? <PtsTag pts={line.points} signed /> : <span className="e-num text-[11px] text-ink-500">{line?.goals ?? 0} ⚽</span>}
                </span>
              </div>
            );
          })}
          {myLines.length > 0 && (
            <div className="px-1 text-right text-xs text-ink-300">
              Round total: <span className="e-num font-bold text-mint-300">{fmtPts(myLines.reduce((a, b) => a + b.points, 0))} pts</span>
            </div>
          )}
        </div>
      )}

      {/* picker */}
      {open && teamsKnown && (
        <>
          <div className="flex gap-2">
            <label className="e-card flex flex-1 items-center gap-2 px-3 py-2">
              <Search size={14} className="text-ink-400" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search forwards…" className="w-full bg-transparent text-sm text-ink-100 placeholder:text-ink-500 focus:outline-none" />
            </label>
            <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="e-input w-32">
              <option value="ALL">All teams</option>
              {[...phaseTeamIds].map((tid) => (
                <option key={tid} value={tid}>
                  {teamById.get(tid)?.name ?? tid}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            {pool.map(({ p, o }) => {
              const sel = picked.includes(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={`e-card flex w-full items-center justify-between gap-2 p-3 text-left transition ${sel ? "ring-volt-400/50 bg-volt-400/[0.06]" : "e-card-hover"}`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-semibold ${sel ? "text-volt-300" : "text-white"}`}>{p.name}</span>
                    <TeamMark team={teamById.get(p.teamId)} size="sm" muted />
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="w-20">
                      <ProbBar pct={o.prob} />
                      <span className="e-num mt-1 block text-[10px] text-skyx-300">{fmtProb(o.prob)} to score</span>
                    </span>
                    <span className="e-num w-18 text-right text-[11px] font-bold text-mint-300">+{fmtPts(scorerPointsPerGoal(phase, o.odds))}/⚽</span>
                  </span>
                </button>
              );
            })}
          </div>

          {/* tray */}
          <div className="fixed inset-x-0 bottom-16 z-30">
            <div className="mx-auto max-w-xl px-4">
              <div className="e-card flex items-center justify-between gap-2 p-2.5 shadow-glow">
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {picked.length === 0 ? (
                    <span className="px-1 text-xs text-ink-400">Pick {limit} forwards…</span>
                  ) : (
                    picked.map((pid) => (
                      <span key={pid} className="e-chip bg-white/[0.07] text-ink-100 ring-1 ring-white/[0.08]">
                        {playerById.get(pid)?.name.split(" ").slice(-1)[0] ?? pid}
                        <button onClick={() => toggle(pid)} className="text-ink-400 hover:text-white">
                          <X size={10} />
                        </button>
                      </span>
                    ))
                  )}
                </div>
                <Btn variant="primary" size="sm" disabled={picked.length !== limit} onClick={() => setConfirmOpen(true)}>
                  <Lock size={12} /> Lock {picked.length}/{limit}
                </Btn>
              </div>
            </div>
          </div>
        </>
      )}

      {!teamsKnown && !my?.locked && <EmptyState emoji="⏳">This round's teams aren't decided yet — picks open when the bracket is set.</EmptyState>}
      {teamsKnown && !open && !my?.locked && <EmptyState emoji="🔒">This round's scorer picks are closed{me ? " — you didn't lock a set." : "."}</EmptyState>}

      {/* everyone's picks */}
      {revealPhase(phase) && (
        <div className="space-y-1.5">
          <SectionTitle hint="revealed at round start">Everyone's picks</SectionTitle>
          {state.users
            .filter((u) => !u.isAdmin)
            .map((u) => {
              const sp = state.predictions[u.id]?.scorers[phase];
              if (!sp?.locked) return (
                <div key={u.id} className="e-card flex items-center justify-between p-2.5 text-xs text-ink-500">
                  <span>{u.emoji} {u.name}</span><span>no picks</span>
                </div>
              );
              const lines = (scoreOf(u.id)?.scorerLines ?? []).filter((l) => l.phase === phase);
              const total = lines.reduce((a, b) => a + b.points, 0);
              return (
                <div key={u.id} className="e-card p-2.5">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-100">{u.emoji} {u.name}</span>
                    {total > 0 && <PtsTag pts={total} signed />}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {sp.playerIds.map((pid) => {
                      const line = lines.find((l) => l.playerId === pid);
                      return (
                        <span key={pid} className={`e-chip ring-1 ${line && line.goals > 0 ? "bg-mint-500/15 text-mint-300 ring-mint-500/25" : "bg-white/[0.05] text-ink-300 ring-white/[0.06]"}`}>
                          {playerById.get(pid)?.name.split(" ").slice(-1)[0] ?? pid}
                          {line && line.goals > 0 && <span className="e-num">{line.goals}⚽</span>}
                        </span>
                      );
                    })}
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {/* lock modal */}
      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={`Lock ${limit} scorer picks?`}
        footer={
          <>
            <Btn onClick={() => setConfirmOpen(false)}>Not yet</Btn>
            <Btn variant="primary" onClick={doLock}>
              <Lock size={14} /> Lock them in
            </Btn>
          </>
        }
      >
        <ul className="space-y-1">
          {picked.map((pid) => {
            const p = playerById.get(pid);
            const o = p ? scorerOddsFor(p, phase) : null;
            return (
              <li key={pid} className="flex items-center justify-between text-sm">
                <span className="text-ink-100">{p?.name ?? pid}</span>
                {o && (
                  <span className="flex items-center gap-2">
                    <span className="e-num text-xs text-skyx-300">{fmtProb(o.prob)}</span>
                    <span className="e-num text-xs font-bold text-mint-300">+{fmtPts(scorerPointsPerGoal(phase, o.odds))}/goal</span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="text-xs text-ink-400">
          Odds freeze per player at lock. The whole set locks together and
          <span className="font-semibold text-punch-300"> can't be changed</span> afterwards.
        </p>
      </Modal>
    </div>
  );
}
