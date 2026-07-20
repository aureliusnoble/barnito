import { BASE_GOAL, BASE_OUTCOME, BASE_TOKEN, CHAMPION_POINTS, OUTCOME_MULT, PHASES, PHASE_LABEL, PHASE_SHORT, PICK_MULT, SCORER_PICKS, TOKENS_BY_PHASE } from "../config";
import { outcomePoints, scorerPointsPerGoal, tokenPoints } from "../lib/scoring";
import { fmtPts, fmtSignedPts } from "../lib/format";
import { FormulaRow, OddsTag, PageHead, PtsTag, SectionTitle } from "../ui/kit";

function ValueTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wide text-ink-500">
            {head.map((h) => (
              <th key={h} className="pb-1.5 pr-3 font-semibold last:pr-0 last:text-right">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-white/[0.04]">
              {r.map((c, j) => (
                <td key={j} className={`e-num py-1.5 pr-3 last:pr-0 last:text-right ${j === 0 ? "text-ink-100" : "text-ink-300"} ${j === r.length - 1 ? "font-bold text-volt-300" : ""}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Rules() {
  return (
    <div className="space-y-4">
      <PageHead title="How scoring works" sub="One idea everywhere: right call × round × how unlikely it was." />

      <section className="e-card p-4">
        <SectionTitle>The big idea</SectionTitle>
        <p className="text-sm text-ink-200">
          You earn points for being <span className="font-bold text-white">right</span>, multiplied by
          <span className="font-bold text-punch-300"> how unlikely</span> your call was — the decimal odds at the moment you lock —
          and by the <span className="font-bold text-skyx-300">round</span>. Backing a 12% upset pays ~8× more than the same call on a favourite.
        </p>
        <ul className="mt-2 space-y-1 text-xs text-ink-300">
          <li>🔒 <span className="font-semibold text-ink-100">Locks are permanent</span> and freeze the odds for you. Odds drift over time — lock timing matters.</li>
          <li>🙈 Unlocked picks score <span className="font-semibold text-ink-100">nothing</span>.</li>
          <li>👀 Everyone's picks stay hidden until kickoff of the match (or round).</li>
          <li>📉 There are <span className="font-semibold text-ink-100">no group-standings points</span> this time (unlike the World Cup edition).</li>
        </ul>
      </section>

      <section className="e-card p-4">
        <SectionTitle hint="every match">Match results</SectionTitle>
        <p className="mb-2 text-sm text-ink-200">
          Pick <span className="font-semibold text-white">Home, Draw or Away</span>. Group games score on the full-time result; knockout games
          score on the result <span className="font-semibold text-white">at the end of extra time</span> — a draw after extra time stands and pays,
          penalties only decide who advances. Each round is worth <span className="font-bold text-white">2× the last</span>.
        </p>
        <FormulaRow
          parts={[
            { v: String(BASE_OUTCOME), label: "base" },
            { v: `×${OUTCOME_MULT.qf}`, label: "QF" },
            { v: "×7.14", label: "odds" },
          ]}
          result={`${fmtPts(outcomePoints("qf", 7.14))} pts`}
        />
        <div className="mt-3">
          <ValueTable
            head={["Round", "Multiplier", "At odds ×2.00"]}
            rows={PHASES.map((p) => [PHASE_LABEL[p], `×${OUTCOME_MULT[p]}`, `${fmtPts(outcomePoints(p, 2))} pts`])}
          />
        </div>
      </section>

      <section className="e-card p-4">
        <SectionTitle hint="before kickoff no.1">Champion</SectionTitle>
        <p className="text-sm text-ink-200">
          One team, locked before the opening match. Worth a flat <PtsTag pts={CHAMPION_POINTS} /> — that's 2× the final's round value
          ({BASE_OUTCOME} × {OUTCOME_MULT.final} × 2). Outright odds are shown when you pick, purely for bragging rights.
        </p>
      </section>

      <section className="e-card p-4">
        <SectionTitle hint="forwards only">Scorers</SectionTitle>
        <p className="mb-2 text-sm text-ink-200">
          Pick a fresh set of forwards each round. Every goal a pick scores in that round pays
          {" "}{BASE_GOAL} × round × their scoring odds. Fewer picks each round — so the multiplier jumps <span className="font-bold text-white">×4 per round</span>.
        </p>
        <ValueTable
          head={["Round", "Picks", "Multiplier", "Goal at odds ×4.00"]}
          rows={PHASES.map((p) => [PHASE_SHORT[p], SCORER_PICKS[p], `×${PICK_MULT[p]}`, `${fmtPts(scorerPointsPerGoal(p, 4))} pts`])}
        />
        <p className="mt-2 text-xs text-ink-400">The whole set locks at once, before the round's first kickoff; each player's odds freeze at lock.</p>
      </section>

      <section className="e-card p-4">
        <SectionTitle hint="the risk lever">Tokens</SectionTitle>
        <p className="mb-2 text-sm text-ink-200">
          Each round you get tokens equal to half the games. Stack any number on a team in a match. Each token pays
          {" "}{BASE_TOKEN} × <span className="font-semibold text-white">goal margin</span> × round × that team's win odds.
          In knockouts the margin is taken at the <span className="font-semibold text-white">end of extra time</span> (shootouts don't move it).
        </p>
        <div className="mb-2 flex flex-wrap gap-2 text-xs">
          <span className="e-chip bg-mint-500/15 text-mint-300 ring-1 ring-mint-500/25">
            win by 2 at ×3.00 (R16): {fmtSignedPts(tokenPoints("r16", 1, 2, 3))} / token
          </span>
          <span className="e-chip bg-red-500/15 text-red-300 ring-1 ring-red-500/30">
            lose by 1 at ×3.00 (R16): {fmtSignedPts(tokenPoints("r16", 1, -1, 3))} / token
          </span>
        </div>
        <ValueTable
          head={["Round", "Tokens", "Multiplier"]}
          rows={PHASES.map((p) => [PHASE_SHORT[p], TOKENS_BY_PHASE[p], `×${PICK_MULT[p]}`])}
        />
        <p className="mt-2 text-xs text-red-300">⚠️ Margins are signed: a backed team losing SUBTRACTS points at the same rate.</p>
      </section>

      <section className="e-card p-4">
        <SectionTitle hint="the multiplier">Odds</SectionTitle>
        <p className="text-sm text-ink-200">
          Odds here are <span className="font-semibold text-white">fair odds</span> — 1 ÷ probability, no bookmaker margin. An outcome priced
          {" "}<OddsTag odds={4} /> is a 25% shot and quadruples your points. Prices drift as the market "thinks", so the moment you lock is the multiplier you keep — forever.
        </p>
      </section>
    </div>
  );
}
