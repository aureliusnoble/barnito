import { useMemo, useState } from "react";
import { AlertTriangle, Coins, Lock } from "lucide-react";
import type { EPhase, TokenAssign } from "../types";
import { BASE_TOKEN, PHASES, PHASE_SHORT, TOKENS_BY_PHASE } from "../config";
import { useEuro } from "../store/store";
import { tokenPoints } from "../lib/scoring";
import { fmtDay, fmtFull, fmtSignedPts, fmtTime } from "../lib/format";
import { Btn, CountdownPill, EmptyState, LockBadge, Modal, PageHead, PtsTag, SectionTitle, Stepper, Tabs, TeamMark, useToast } from "../ui/kit";

/** The market line (expected goal margin, signed) — what a token has to beat. */
function LineTag({ line }: { line: number }) {
  return (
    <span className="e-chip e-num bg-punch-500/15 text-punch-300 ring-1 ring-punch-500/25">
      line {line > 0 ? "+" : ""}{line.toFixed(1)}
    </span>
  );
}

export default function Tokens() {
  const { me, state, nowMs, teamById, fixtureById, phaseFirstKickoff, phaseTeamsKnown, canLockPhase, revealPhase, spreadFor, setTokenDraft, lockTokens, scoreOf } = useEuro();
  const { toast } = useToast();
  const [phase, setPhase] = useState<EPhase>("group");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const wallet = TOKENS_BY_PHASE[phase];
  const my = me ? state.predictions[me.id]?.tokens[phase] : undefined;
  const assigns = useMemo(() => my?.assigns ?? [], [my]);
  const placed = assigns.reduce((a, b) => a + b.count, 0);
  const open = canLockPhase(phase) && !my?.locked;
  const teamsKnown = phaseTeamsKnown(phase);

  const fixtures = useMemo(
    () => state.fixtures.filter((f) => f.phase === phase).sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
    [state.fixtures, phase],
  );

  const countFor = (fid: string, tid: string) => assigns.find((a) => a.fixtureId === fid && a.teamId === tid)?.count ?? 0;
  const setCount = (fid: string, tid: string, count: number) => {
    const next: TokenAssign[] = assigns.filter((a) => !(a.fixtureId === fid && a.teamId === tid));
    if (count > 0) next.push({ fixtureId: fid, teamId: tid, count });
    const err = setTokenDraft(phase, next);
    if (err) toast(err, "err");
  };

  const doLock = () => {
    const err = lockTokens(phase);
    if (err) toast(err, "err");
    else toast("Token allocation locked 🔒");
    setConfirmOpen(false);
  };

  const myLines = me ? (scoreOf(me.id)?.tokenLines ?? []).filter((l) => l.phase === phase) : [];
  const phaseTotal = myLines.reduce((a, b) => a + b.points, 0);
  // One goal better/worse than the line, per token.
  const perGoal = (n: number) => tokenPoints(phase, n, 1, 0);

  return (
    <div className="space-y-4 pb-16">
      <PageHead
        title="Tokens"
        sub={`Beat the market's line: each token pays ${BASE_TOKEN} × (final margin − the line) × round. Both sides are priced fair — only a better read than the market earns points.`}
      />
      <Tabs options={PHASES.map((p) => ({ value: p, label: PHASE_SHORT[p] }))} value={phase} onChange={setPhase} />

      {/* wallet */}
      <div className="e-card flex flex-wrap items-center justify-between gap-2 p-3.5">
        <span className="flex items-center gap-2 text-sm">
          <Coins size={16} className="text-volt-400" />
          <span className="e-num font-grotesk text-lg font-extrabold text-white">
            {placed}<span className="text-ink-500">/{wallet}</span>
          </span>
          <span className="text-ink-300">placed</span>
          <span className="e-chip bg-punch-500/15 text-punch-300 ring-1 ring-punch-500/25">±{perGoal(1)}/goal·token</span>
          {my?.locked && <LockBadge lockedAt={my.lockedAt} />}
        </span>
        <span className="flex items-center gap-2 text-[11px] text-ink-400">
          {teamsKnown ? (
            <>
              locks {fmtFull(new Date(phaseFirstKickoff(phase)).toISOString())}{" "}
              <CountdownPill toIso={new Date(phaseFirstKickoff(phase)).toISOString()} nowMs={nowMs} />
            </>
          ) : (
            "Opens once the round's teams are set"
          )}
        </span>
      </div>

      {/* locked results view */}
      {my?.locked && (
        <div className="space-y-1.5">
          <SectionTitle hint={phaseTotal !== 0 ? `${fmtSignedPts(phaseTotal)} pts this round` : "awaiting results"}>Your allocation</SectionTitle>
          {my.assigns.map((a, i) => {
            const f = fixtureById.get(a.fixtureId);
            const t = teamById.get(a.teamId);
            const line = my.spreadByAssign?.[`${a.fixtureId}:${a.teamId}`] ?? 0;
            const scored = myLines.find((l) => l.fixtureId === a.fixtureId && l.teamId === a.teamId);
            return (
              <div key={i} className="e-card flex items-center justify-between gap-2 p-3">
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm">
                    <span className="e-chip bg-volt-400/15 text-volt-300 ring-1 ring-volt-400/25">{a.count}🪙</span>
                    <TeamMark team={t} size="sm" />
                  </span>
                  <span className="text-[11px] text-ink-500">
                    v {teamById.get(f?.homeTeamId === a.teamId ? f?.awayTeamId ?? "" : f?.homeTeamId ?? "")?.name ?? "?"} · {f ? fmtDay(f.kickoff) : ""}
                  </span>
                </span>
                <span className="flex items-center gap-1.5">
                  <LineTag line={line} />
                  {scored ? (
                    <>
                      <span className={`e-num text-[11px] ${scored.netDiff - scored.spread >= 0 ? "text-mint-300" : "text-red-300"}`}>
                        margin {scored.netDiff > 0 ? "+" : ""}{scored.netDiff}
                      </span>
                      <PtsTag pts={scored.points} signed />
                    </>
                  ) : (
                    <span className="text-[11px] text-ink-500">pending</span>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* allocator */}
      {open && teamsKnown && (
        <>
          <div className="space-y-2">
            {fixtures.map((f) => {
              const home = f.homeTeamId ? teamById.get(f.homeTeamId) : undefined;
              const away = f.awayTeamId ? teamById.get(f.awayTeamId) : undefined;
              if (!home || !away) return null;
              return (
                <div key={f.id} className="e-card p-3">
                  <div className="mb-1.5 text-[11px] text-ink-400">
                    {fmtDay(f.kickoff)} · {fmtTime(f.kickoff)} · {f.venue}
                  </div>
                  {[home, away].map((t) => {
                    const line = spreadFor(f, t.id);
                    const n = countFor(f.id, t.id);
                    const canAdd = placed < wallet;
                    return (
                      <div key={t.id} className="flex items-center justify-between gap-2 py-1">
                        <span className="flex min-w-0 items-center gap-1.5">
                          <TeamMark team={t} size="sm" />
                          {line != null && <LineTag line={line} />}
                        </span>
                        <span className="flex items-center gap-2">
                          {n > 0 && line != null && (
                            <span className="e-num hidden text-[10px] text-ink-400 sm:block">
                              <span className="text-mint-300">+{perGoal(n)}</span> /goal past the line ·{" "}
                              <span className="text-red-300">−{perGoal(n)}</span> /goal short
                            </span>
                          )}
                          <Stepper value={n} min={0} max={n + (canAdd ? 1 : 0)} onChange={(v) => setCount(f.id, t.id, v)} />
                        </span>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>

          {/* tray */}
          <div className="fixed inset-x-0 bottom-16 z-30">
            <div className="mx-auto max-w-xl px-4">
              <div className="e-card flex items-center justify-between gap-2 p-2.5 shadow-glow">
                <span className="text-xs text-ink-300">
                  <span className="e-num font-bold text-white">{wallet - placed}</span> token{wallet - placed === 1 ? "" : "s"} left
                </span>
                <Btn variant="primary" size="sm" disabled={placed === 0} onClick={() => setConfirmOpen(true)}>
                  <Lock size={12} /> Lock allocation
                </Btn>
              </div>
            </div>
          </div>
        </>
      )}

      {!teamsKnown && !my?.locked && <EmptyState emoji="⏳">This round's teams aren't decided yet — tokens open when the bracket is set.</EmptyState>}
      {teamsKnown && !open && !my?.locked && <EmptyState emoji="🔒">This round's tokens are closed — no allocation locked.</EmptyState>}

      {/* everyone's allocations */}
      {revealPhase(phase) && (
        <div className="space-y-1.5">
          <SectionTitle hint="revealed at round start">Everyone's tokens</SectionTitle>
          {state.users
            .filter((u) => !u.isAdmin)
            .map((u) => {
              const tp = state.predictions[u.id]?.tokens[phase];
              if (!tp?.locked)
                return (
                  <div key={u.id} className="e-card flex items-center justify-between p-2.5 text-xs text-ink-500">
                    <span>{u.emoji} {u.name}</span>
                    <span>no tokens</span>
                  </div>
                );
              const lines = (scoreOf(u.id)?.tokenLines ?? []).filter((l) => l.phase === phase);
              const total = lines.reduce((a, b) => a + b.points, 0);
              return (
                <div key={u.id} className="e-card p-2.5">
                  <div className="mb-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-ink-100">{u.emoji} {u.name}</span>
                    {lines.length > 0 && <PtsTag pts={total} signed />}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {tp.assigns.map((a, i) => {
                      const line = tp.spreadByAssign?.[`${a.fixtureId}:${a.teamId}`] ?? 0;
                      return (
                        <span key={i} className="e-chip bg-white/[0.05] text-ink-200 ring-1 ring-white/[0.06]">
                          {a.count}🪙 {teamById.get(a.teamId)?.code ?? a.teamId}
                          <span className="e-num text-punch-300">{line > 0 ? "+" : ""}{line.toFixed(1)}</span>
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
        title="Lock your token allocation?"
        footer={
          <>
            <Btn onClick={() => setConfirmOpen(false)}>Not yet</Btn>
            <Btn variant="primary" onClick={doLock}>
              <Lock size={14} /> Lock tokens
            </Btn>
          </>
        }
      >
        <ul className="space-y-1">
          {assigns.map((a, i) => {
            const f = fixtureById.get(a.fixtureId);
            const t = teamById.get(a.teamId);
            const line = f ? spreadFor(f, a.teamId) : null;
            return (
              <li key={i} className="flex items-center justify-between text-sm">
                <span className="text-ink-100">
                  {a.count}🪙 on {t?.name ?? a.teamId}
                </span>
                {line != null && (
                  <span className="flex items-center gap-1.5">
                    <LineTag line={line} />
                    <span className="e-num text-[11px]">
                      <span className="text-mint-300">{fmtSignedPts(tokenPoints(phase, a.count, line + 1, line))}</span>
                      <span className="text-ink-500"> /goal past · </span>
                      <span className="text-red-300">{fmtSignedPts(tokenPoints(phase, a.count, line - 1, line))}</span>
                      <span className="text-ink-500"> /goal short</span>
                    </span>
                  </span>
                )}
              </li>
            );
          })}
        </ul>
        <p className="flex items-start gap-1.5 text-xs text-ink-400">
          <AlertTriangle size={14} className="mt-0.5 shrink-0 text-red-300" />
          The line freezes now. Your team's final goal margin is measured against it — finish short and the
          same rate <span className="font-semibold text-red-300">subtracts</span> points. Locking is permanent.
        </p>
      </Modal>
    </div>
  );
}
