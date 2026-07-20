import { useMemo, useState } from "react";
import { Crown, Lock } from "lucide-react";
import { CHAMPION_POINTS } from "../config";
import { useEuro, winnerOf } from "../store/store";
import { fmtFull, fmtOdds, fmtPts } from "../lib/format";
import { Btn, CountdownPill, LockBadge, Modal, OddsTag, PageHead, ProbTag, PtsTag, SectionTitle, TeamMark, useToast } from "../ui/kit";

export default function Champion() {
  const { me, state, nowMs, teams, teamById, outright, phaseFirstKickoff, revealPhase, setChampionDraft, lockChampion } = useEuro();
  const { toast } = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const deadline = phaseFirstKickoff("group");
  const openForPicks = nowMs < deadline;
  const my = me ? state.predictions[me.id]?.champion : null;
  const champion = winnerOf(state.fixtures.find((f) => f.phase === "final") ?? state.fixtures[0]);

  const ranked = useMemo(
    () => [...teams].sort((a, b) => (outright.get(a.id)?.prob ?? 0) < (outright.get(b.id)?.prob ?? 0) ? 1 : -1),
    [teams, outright],
  );

  // A pick is "dead" once its team lost a finished knockout, or groups are done
  // and it isn't in any knockout slot.
  const eliminated = (teamId: string): boolean => {
    const koFixtures = state.fixtures.filter((f) => f.phase !== "group");
    for (const f of koFixtures) {
      if (f.status === "FINISHED" && (f.homeTeamId === teamId || f.awayTeamId === teamId) && winnerOf(f) !== teamId) {
        // Losing a knockout ends the run (the loser can't be champion).
        return true;
      }
    }
    const r16 = koFixtures.filter((f) => f.id.startsWith("r16-"));
    const r16Known = r16.every((f) => f.homeTeamId && f.awayTeamId);
    if (r16Known && !koFixtures.some((f) => f.homeTeamId === teamId || f.awayTeamId === teamId)) return true;
    return false;
  };

  const doLock = () => {
    const err = lockChampion();
    if (err) toast(err, "err");
    else toast("Champion locked 🔒");
    setConfirmOpen(false);
  };

  const draftTeam = my && !my.locked ? teamById.get(my.teamId) : undefined;

  return (
    <div className="space-y-4 pb-14">
      <PageHead
        title="Champion"
        sub={
          <>
            One team, locked before kick-off. Worth a flat <span className="e-num font-bold text-volt-300">{fmtPts(CHAMPION_POINTS)} pts</span> — outright odds shown for bragging only.
          </>
        }
      />

      {/* status / my pick */}
      {my?.locked ? (
        <div className="e-card p-4 text-center ring-1 ring-volt-400/20">
          <div className="text-4xl">{teamById.get(my.teamId)?.flag}</div>
          <div className="mt-1 font-grotesk text-xl font-extrabold text-white">{teamById.get(my.teamId)?.name}</div>
          <div className="mt-1 flex items-center justify-center gap-2 text-xs text-ink-300">
            <LockBadge lockedAt={my.lockedAt} />
            {my.outrightOdds != null && <OddsTag odds={my.outrightOdds} />}
            <PtsTag pts={CHAMPION_POINTS} />
          </div>
          {champion ? (
            champion === my.teamId ? (
              <div className="mt-2 text-sm font-bold text-volt-300">👑 CHAMPIONS — {fmtPts(CHAMPION_POINTS)} pts banked!</div>
            ) : (
              <div className="mt-2 text-sm text-ink-400">The trophy went to {teamById.get(champion)?.name}.</div>
            )
          ) : nowMs >= deadline ? (
            eliminated(my.teamId) ? (
              <div className="mt-2 text-sm text-red-300">Eliminated — no {fmtPts(CHAMPION_POINTS)} pts this time.</div>
            ) : (
              <div className="mt-2 text-sm text-mint-300">Still alive 🤞</div>
            )
          ) : null}
        </div>
      ) : (
        <div className="e-card flex flex-wrap items-center justify-between gap-2 p-3.5 text-sm">
          {openForPicks ? (
            <>
              <span className="text-ink-200">Pick locks at the opening kickoff</span>
              <span className="flex items-center gap-2 text-[11px] text-ink-400">
                {fmtFull(new Date(deadline).toISOString())} <CountdownPill toIso={new Date(deadline).toISOString()} nowMs={nowMs} />
              </span>
            </>
          ) : (
            <span className="text-ink-400">The tournament has started — champion picks are closed{me ? " and you didn't lock one" : ""}.</span>
          )}
        </div>
      )}

      {/* team grid */}
      {openForPicks && !my?.locked && (
        <div className="grid grid-cols-2 gap-2">
          {ranked.map((t) => {
            const o = outright.get(t.id);
            const sel = my?.teamId === t.id;
            return (
              <button
                key={t.id}
                onClick={() => {
                  const err = setChampionDraft(t.id);
                  if (err) toast(err, "err");
                }}
                className={`e-card flex items-center justify-between gap-1.5 p-3 text-left transition ${sel ? "ring-volt-400/50 bg-volt-400/[0.06]" : "e-card-hover"}`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="text-lg">{t.flag}</span>
                  <span className="min-w-0">
                    <span className={`block truncate text-sm font-semibold ${sel ? "text-volt-300" : "text-white"}`}>{t.name}</span>
                    <span className="text-[10px] text-ink-500">Group {t.group}</span>
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-0.5">
                  {o && <OddsTag odds={o.odds} />}
                  {o && <ProbTag prob={o.prob} />}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* draft footer */}
      {draftTeam && openForPicks && (
        <div className="fixed inset-x-0 bottom-16 z-30">
          <div className="mx-auto max-w-xl px-4">
            <div className="e-card flex items-center justify-between gap-2 p-2.5 shadow-glow">
              <span className="flex items-center gap-2 text-sm text-ink-100">
                <Crown size={15} className="text-volt-400" /> {draftTeam.flag} {draftTeam.name}
              </span>
              <Btn variant="primary" size="sm" onClick={() => setConfirmOpen(true)}>
                <Lock size={12} /> Lock champion
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* everyone's picks after tournament start */}
      {revealPhase("group") && (
        <div className="space-y-1.5">
          <SectionTitle hint="revealed at kickoff">Everyone's champions</SectionTitle>
          {state.users
            .filter((u) => !u.isAdmin)
            .map((u) => {
              const c = state.predictions[u.id]?.champion;
              const t = c ? teamById.get(c.teamId) : undefined;
              const correct = !!champion && c?.locked && c.teamId === champion;
              return (
                <div key={u.id} className="e-card flex items-center justify-between p-2.5 text-sm">
                  <span className="text-ink-100">{u.emoji} {u.name}</span>
                  {c?.locked && t ? (
                    <span className="flex items-center gap-1.5">
                      <TeamMark team={t} size="sm" />
                      {c.outrightOdds != null && <span className="e-num text-[11px] text-punch-300">×{fmtOdds(c.outrightOdds)}</span>}
                      {correct && <span className="e-chip bg-volt-400/15 text-volt-300 ring-1 ring-volt-400/30">👑 +{fmtPts(CHAMPION_POINTS)}</span>}
                      {!correct && champion && <span className="text-[10px] text-ink-500">0</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-500">no pick</span>
                  )}
                </div>
              );
            })}
        </div>
      )}

      {/* lock modal */}
      {draftTeam && (
        <Modal
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title="Lock your champion?"
          footer={
            <>
              <Btn onClick={() => setConfirmOpen(false)}>Not yet</Btn>
              <Btn variant="primary" onClick={doLock}>
                <Lock size={14} /> Crown them
              </Btn>
            </>
          }
        >
          <div className="text-center">
            <div className="text-4xl">{draftTeam.flag}</div>
            <div className="mt-1 font-grotesk text-lg font-bold text-white">{draftTeam.name}</div>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm">
            {outright.get(draftTeam.id) && <OddsTag odds={outright.get(draftTeam.id)!.odds} />}
            <PtsTag pts={CHAMPION_POINTS} />
          </div>
          <p className="text-center text-xs text-ink-400">
            Flat {fmtPts(CHAMPION_POINTS)} pts if they lift the trophy. Locking is
            <span className="font-semibold text-punch-300"> permanent</span>.
          </p>
        </Modal>
      )}
    </div>
  );
}
