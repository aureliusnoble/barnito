// The predict-and-lock card — the surface users live on. Shows probability,
// odds, and exact potential points for every option BEFORE lock-in; freezes
// odds at lock; reveals everyone's picks once the ball is rolling.

import { useMemo, useState } from "react";
import { ChevronDown, Lock, MapPin } from "lucide-react";
import type { EFixture, Outcome } from "../types";
import { BASE_OUTCOME, OUTCOME_MULT, PHASE_SHORT } from "../config";
import { useEuro } from "../store/store";
import { outcomePoints } from "../lib/scoring";
import { fmtDay, fmtOdds, fmtPts, fmtProb, fmtTime } from "../lib/format";
import { Btn, CountdownPill, FormulaRow, LockBadge, Modal, ProbBar, PtsTag, TeamMark, useToast } from "../ui/kit";

export default function MatchPredictCard({ fixture }: { fixture: EFixture }) {
  const {
    me,
    nowMs,
    teamById,
    playerById,
    state,
    oddsFor,
    canPredictFixture,
    fixtureStarted,
    revealFixture,
    setOutcomeDraft,
    lockOutcome,
    scoreOf,
  } = useEuro();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [othersOpen, setOthersOpen] = useState(false);

  const home = fixture.homeTeamId ? teamById.get(fixture.homeTeamId) : undefined;
  const away = fixture.awayTeamId ? teamById.get(fixture.awayTeamId) : undefined;
  const odds = oddsFor(fixture);
  const finished = fixture.status === "FINISHED";
  const started = fixtureStarted(fixture);
  const myPred = me ? state.predictions[me.id]?.outcomes[fixture.id] : undefined;
  const earned = me ? scoreOf(me.id)?.outcomeLines.find((l) => l.fixtureId === fixture.id) : undefined;

  const optionLabel = (o: Outcome) => (o === "H" ? home?.code ?? "HOME" : o === "A" ? away?.code ?? "AWAY" : "DRAW");
  const pickName = (o: Outcome) => (o === "H" ? home?.name ?? "Home" : o === "A" ? away?.name ?? "Away" : "Draw");

  const others = useMemo(() => {
    if (!revealFixture(fixture)) return [];
    return state.users
      .filter((u) => !u.isAdmin && u.id !== me?.id)
      .map((u) => ({ user: u, pred: state.predictions[u.id]?.outcomes[fixture.id] }))
      .filter((x) => x.pred?.locked);
  }, [state, fixture, me, revealFixture]);

  const doLock = () => {
    const err = lockOutcome(fixture.id);
    if (err) toast(err, "err");
    else toast("Locked in — odds frozen 🔒");
    setConfirmOpen(false);
  };

  return (
    <div className="e-card p-3.5">
      {/* header */}
      <div className="mb-2.5 flex items-center justify-between text-[11px] text-ink-400">
        <span className="flex items-center gap-1.5">
          <span className="e-chip bg-white/[0.05] text-ink-300 ring-1 ring-white/[0.06]">{PHASE_SHORT[fixture.phase]}{fixture.group ? ` · ${fixture.group}` : ""}</span>
          {fmtDay(fixture.kickoff)} · {fmtTime(fixture.kickoff)}
          <span className="hidden items-center gap-0.5 sm:inline-flex"><MapPin size={10} />{fixture.venue}</span>
        </span>
        {finished ? (
          <span className="e-chip bg-white/[0.06] text-ink-200 ring-1 ring-white/[0.08]">Full time</span>
        ) : started ? (
          <span className="e-chip bg-punch-500/15 text-punch-300 ring-1 ring-punch-500/25">Kicked off</span>
        ) : (
          <CountdownPill toIso={fixture.kickoff} nowMs={nowMs} />
        )}
      </div>

      {/* teams + score */}
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between">
            {home ? <TeamMark team={home} /> : <span className="text-sm text-ink-400">{fixture.homeLabel ?? "TBD"}</span>}
            {fixture.homeGoals != null && <span className="e-num font-grotesk text-lg font-extrabold text-white">{fixture.homeGoals}</span>}
          </div>
          <div className="flex items-center justify-between">
            {away ? <TeamMark team={away} /> : <span className="text-sm text-ink-400">{fixture.awayLabel ?? "TBD"}</span>}
            {fixture.awayGoals != null && <span className="e-num font-grotesk text-lg font-extrabold text-white">{fixture.awayGoals}</span>}
          </div>
        </div>
      </div>
      {finished && fixture.penWinnerTeamId && (
        <div className="mb-1 text-[11px] text-punch-300">{teamById.get(fixture.penWinnerTeamId)?.name} win on penalties</div>
      )}
      {finished && fixture.scorers.length > 0 && (
        <div className="mb-1 text-[11px] text-ink-400">
          ⚽ {fixture.scorers.map((s) => `${playerById.get(s.playerId)?.name ?? s.playerId}${s.count > 1 ? ` ×${s.count}` : ""}`).join(", ")}
        </div>
      )}

      {/* predict zone */}
      {!home || !away ? (
        <p className="mt-1 text-xs text-ink-500">Slot decided later — predictions open once both teams are known.</p>
      ) : myPred?.locked ? (
        <div className="mt-2 rounded-xl bg-white/[0.04] p-2.5 ring-1 ring-white/[0.06]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm">
              <LockBadge lockedAt={myPred.lockedAt} />
              <span className="font-semibold text-white">{pickName(myPred.pick)}</span>
              {myPred.prob != null && <span className="e-num text-xs text-skyx-300">{fmtProb(myPred.prob)}</span>}
            </span>
            {finished ? (
              earned?.correct ? (
                <PtsTag pts={earned.points} signed />
              ) : (
                <span className="e-chip bg-white/[0.06] text-ink-400 ring-1 ring-white/[0.08]">wrong · 0 pts</span>
              )
            ) : (
              myPred.odds != null && (
                <span className="text-[11px] text-ink-400">
                  worth <span className="e-num font-bold text-volt-300">{fmtPts(outcomePoints(fixture.phase, myPred.odds))} pts</span> if right
                </span>
              )
            )}
          </div>
        </div>
      ) : canPredictFixture(fixture) && odds ? (
        <>
          <div className="mt-2 grid grid-cols-3 gap-1.5">
            {(["H", "D", "A"] as Outcome[]).map((o) => {
              const sel = myPred?.pick === o;
              return (
                <button
                  key={o}
                  onClick={() => {
                    const err = setOutcomeDraft(fixture.id, o);
                    if (err) toast(err, "err");
                  }}
                  className={`flex flex-col gap-1 rounded-xl p-2 text-left ring-1 transition ${
                    sel ? "bg-volt-400/10 ring-volt-400/50" : "bg-white/[0.04] ring-white/[0.06] hover:bg-white/[0.07]"
                  }`}
                >
                  <span className={`text-xs font-bold ${sel ? "text-volt-300" : "text-ink-100"}`}>{optionLabel(o)}</span>
                  <ProbBar pct={odds.probs[o]} />
                  <span className="flex items-center justify-between text-[11px]">
                    <span className="e-num text-skyx-300">{fmtProb(odds.probs[o])}</span>
                    <span className="e-num font-bold text-mint-300">+{fmtPts(outcomePoints(fixture.phase, odds.odds[o]))}</span>
                  </span>
                </button>
              );
            })}
          </div>
          {myPred && !myPred.locked && (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-ink-800/70 p-2 ring-1 ring-white/[0.06]">
              <span className="text-xs text-ink-300">
                {pickName(myPred.pick)} · <span className="e-num text-skyx-300">{fmtProb(odds.probs[myPred.pick])}</span> →{" "}
                <span className="e-num font-bold text-volt-300">+{fmtPts(outcomePoints(fixture.phase, odds.odds[myPred.pick]))} pts</span>
              </span>
              <Btn variant="primary" size="sm" onClick={() => setConfirmOpen(true)}>
                <Lock size={12} /> Lock in
              </Btn>
            </div>
          )}
        </>
      ) : started && !finished ? (
        <p className="mt-1 text-xs text-ink-500">In play — no lock made, 0 pts possible.</p>
      ) : !myPred?.locked && finished ? (
        <p className="mt-1 text-xs text-ink-500">No prediction locked for this one.</p>
      ) : null}

      {/* everyone's picks (post-kickoff) */}
      {others.length > 0 && (
        <div className="mt-2">
          <button onClick={() => setOthersOpen(!othersOpen)} className="flex w-full items-center justify-between text-xs font-semibold text-ink-300 hover:text-white">
            Everyone's picks ({others.length})
            <ChevronDown size={14} className={`transition ${othersOpen ? "rotate-180" : ""}`} />
          </button>
          {othersOpen && (
            <ul className="mt-1.5 space-y-1">
              {others.map(({ user, pred }) => {
                const line = scoreOf(user.id)?.outcomeLines.find((l) => l.fixtureId === fixture.id);
                return (
                  <li key={user.id} className="flex items-center justify-between rounded-lg bg-white/[0.03] px-2 py-1 text-xs">
                    <span className="text-ink-200">
                      {user.emoji} {user.name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-white">{optionLabel(pred!.pick)}</span>
                      {finished ? (
                        line?.correct ? <PtsTag pts={line.points} /> : <span className="text-ink-500">0</span>
                      ) : (
                        pred!.odds != null && <span className="e-num text-[11px] text-mint-300">+{fmtPts(outcomePoints(fixture.phase, pred!.odds))}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
      {!revealFixture(fixture) && !finished && (
        <p className="mt-2 text-[10px] text-ink-600">🔒 Everyone's picks revealed at kickoff.</p>
      )}

      {/* lock confirm */}
      {myPred && !myPred.locked && odds && home && away && (
        <Modal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Lock this pick?"
          footer={
            <>
              <Btn onClick={() => setConfirmOpen(false)}>Not yet</Btn>
              <Btn variant="primary" onClick={doLock}>
                <Lock size={14} /> Lock it in
              </Btn>
            </>
          }
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-200">
              {home.name} v {away.name}
            </span>
            <span className="font-grotesk font-bold text-white">{pickName(myPred.pick)}</span>
          </div>
          <FormulaRow
            parts={[
              { v: String(BASE_OUTCOME), label: "base" },
              { v: `×${OUTCOME_MULT[fixture.phase]}`, label: PHASE_SHORT[fixture.phase] },
              { v: `×${fmtOdds(odds.odds[myPred.pick])}`, label: "odds" },
            ]}
            result={`${fmtPts(outcomePoints(fixture.phase, odds.odds[myPred.pick]))} pts`}
          />
          <p className="text-xs text-ink-400">
            Implied probability {fmtProb(odds.probs[myPred.pick])}. Locking freezes these odds for you
            <span className="font-semibold text-punch-300"> forever</span> — the pick can't be changed after.
          </p>
          {fixture.phase !== "group" && (
            <p className="text-xs text-skyx-300">
              Knockout: scored on the result at the end of extra time — a draw stands and pays; penalties only decide who advances.
            </p>
          )}
        </Modal>
      )}
    </div>
  );
}
