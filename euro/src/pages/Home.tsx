import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Crown, Goal, Coins, Target, TrendingUp } from "lucide-react";
import { PHASES, PHASE_SHORT, BASE_OUTCOME, OUTCOME_MULT } from "../config";
import { useEuro } from "../store/store";
import { outcomePoints } from "../lib/scoring";
import { fmtOdds, fmtPts } from "../lib/format";
import { CountdownPill, FormulaRow, PageHead, SectionTitle, TeamMark } from "../ui/kit";

export default function Home() {
  const { me, isAdmin, state, nowMs, teamById, scores, oddsFor, canPredictFixture, canLockPhase, phaseFirstKickoff } = useEuro();

  const myPreds = me ? state.predictions[me.id] : undefined;

  // What can I act on right now?
  const actions = useMemo(() => {
    const out: { to: string; icon: React.ReactNode; label: string }[] = [];
    if (!me || isAdmin) return out;
    if (nowMs < phaseFirstKickoff("group") && !myPreds?.champion?.locked)
      out.push({ to: "/picks/champion", icon: <Crown size={14} />, label: "Lock your champion" });
    const openOutcomes = state.fixtures.filter((f) => canPredictFixture(f) && !myPreds?.outcomes[f.id]?.locked).length;
    if (openOutcomes > 0)
      out.push({ to: "/picks/matches", icon: <Target size={14} />, label: `${openOutcomes} match pick${openOutcomes === 1 ? "" : "s"} to lock` });
    for (const ph of PHASES) {
      if (!canLockPhase(ph)) continue;
      if (!myPreds?.scorers[ph]?.locked) out.push({ to: "/picks/scorers", icon: <Goal size={14} />, label: `${PHASE_SHORT[ph]} scorers open` });
      if (!myPreds?.tokens[ph]?.locked) out.push({ to: "/picks/tokens", icon: <Coins size={14} />, label: `${PHASE_SHORT[ph]} tokens open` });
    }
    return out;
  }, [me, isAdmin, state, nowMs, myPreds, canPredictFixture, canLockPhase, phaseFirstKickoff]);

  const nextUp = useMemo(
    () =>
      state.fixtures
        .filter((f) => Date.parse(f.kickoff) > nowMs)
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff))
        .slice(0, 3),
    [state.fixtures, nowMs],
  );

  const admins = new Set(state.users.filter((u) => u.isAdmin).map((u) => u.id));
  const ranked = scores.filter((s) => !admins.has(s.userId)).sort((a, b) => a.rank - b.rank);
  const mine = me ? ranked.find((s) => s.userId === me.id) : undefined;

  // A live worked example for the teaser card.
  const exampleFixture = nextUp.find((f) => oddsFor(f));
  const exOdds = exampleFixture ? oddsFor(exampleFixture) : null;
  const exPick = exOdds ? (exOdds.probs.H < exOdds.probs.A ? "H" : "A") : null; // the underdog side

  return (
    <div className="space-y-5">
      <PageHead
        title={`Alright, ${me?.name?.split(" ")[0] ?? "legend"} ⚡`}
        sub="Back your calls, freeze your odds, bank the points."
      />

      {/* actions */}
      {actions.length > 0 ? (
        <section>
          <SectionTitle hint="do these before kickoff">Get your picks in</SectionTitle>
          <div className="space-y-1.5">
            {actions.map((a, i) => (
              <Link key={i} to={a.to} className="e-card e-card-hover flex items-center justify-between p-3 text-sm text-ink-100">
                <span className="flex items-center gap-2 font-semibold text-white">
                  <span className="text-volt-400">{a.icon}</span> {a.label}
                </span>
                <ArrowRight size={15} className="text-ink-500" />
              </Link>
            ))}
          </div>
        </section>
      ) : (
        !isAdmin && (
          <div className="e-card p-4 text-center text-sm text-ink-300">
            ✅ Everything lockable is locked. Now we wait for football.
          </div>
        )
      )}

      {/* next up */}
      {nextUp.length > 0 && (
        <section>
          <SectionTitle hint="kickoffs">Up next</SectionTitle>
          <div className="space-y-1.5">
            {nextUp.map((f) => {
              const my = myPreds?.outcomes[f.id];
              return (
                <Link key={f.id} to="/picks/matches" className="e-card e-card-hover flex items-center justify-between gap-2 p-3">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {f.homeTeamId ? <TeamMark team={teamById.get(f.homeTeamId)} size="sm" /> : <span className="text-xs text-ink-500">{f.homeLabel}</span>}
                    <span className="text-ink-600">v</span>
                    {f.awayTeamId ? <TeamMark team={teamById.get(f.awayTeamId)} size="sm" /> : <span className="text-xs text-ink-500">{f.awayLabel}</span>}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    {my?.locked && <span className="e-chip bg-volt-400/15 text-volt-300 ring-1 ring-volt-400/25">🔒 {my.pick}</span>}
                    <CountdownPill toIso={f.kickoff} nowMs={nowMs} />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* mini leaderboard */}
      {ranked.length > 0 && (
        <section>
          <SectionTitle hint="top of the table">Leaderboard</SectionTitle>
          <Link to="/table/leaderboard" className="e-card e-card-hover block divide-y divide-white/[0.05] p-1">
            {ranked.slice(0, 3).map((s, i) => (
              <div key={s.userId} className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-ink-100">
                  <span>{["🥇", "🥈", "🥉"][i]}</span> {s.name}
                </span>
                <span className="e-num font-grotesk font-bold text-white">{fmtPts(s.total)}</span>
              </div>
            ))}
            {mine && mine.rank > 3 && (
              <div className="flex items-center justify-between px-3 py-2 text-sm">
                <span className="flex items-center gap-2 text-volt-300">
                  <span className="e-num">#{mine.rank}</span> you
                </span>
                <span className="e-num font-grotesk font-bold text-volt-300">{fmtPts(mine.total)}</span>
              </div>
            )}
          </Link>
        </section>
      )}

      {/* how it works teaser */}
      <section>
        <Link to="/rules" className="e-card e-card-hover block p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 font-grotesk font-bold text-white">
              <TrendingUp size={16} className="text-punch-400" /> Underdogs pay more
            </span>
            <ArrowRight size={15} className="text-ink-500" />
          </div>
          {exampleFixture && exOdds && exPick ? (
            <>
              <p className="mb-2 text-xs text-ink-300">
                Back {teamById.get(exPick === "H" ? exampleFixture.homeTeamId! : exampleFixture.awayTeamId!)?.name} at ×{fmtOdds(exOdds.odds[exPick])} and a correct call pays:
              </p>
              <FormulaRow
                parts={[
                  { v: String(BASE_OUTCOME), label: "base" },
                  { v: `×${OUTCOME_MULT[exampleFixture.phase]}`, label: PHASE_SHORT[exampleFixture.phase] },
                  { v: `×${fmtOdds(exOdds.odds[exPick])}`, label: "odds" },
                ]}
                result={`${fmtPts(outcomePoints(exampleFixture.phase, exOdds.odds[exPick]))} pts`}
              />
            </>
          ) : (
            <FormulaRow
              parts={[
                { v: String(BASE_OUTCOME), label: "base" },
                { v: "×4", label: "QF" },
                { v: "×2.50", label: "odds" },
              ]}
              result={`${fmtPts(outcomePoints("qf", 2.5))} pts`}
            />
          )}
        </Link>
      </section>
    </div>
  );
}
