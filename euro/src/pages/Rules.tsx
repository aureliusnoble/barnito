import type { EPhase } from "../types";
import { PHASES, PHASE_LABEL, PHASE_SHORT, SCORER_PICKS, TOKENS_BY_PHASE } from "../config";
import { championPoints, outcomePoints, scorerPointsPerGoal, tokenPoints } from "../lib/scoring";
import { fmtPts, fmtSignedPts } from "../lib/format";
import { BarBreakdown, PageHead, SectionTitle } from "../ui/kit";

// Every number on this page is computed from config + the scoring engine, so it
// always matches what the app actually pays.

const MATCHES_IN_ROUND: Record<EPhase, number> = { group: 36, r16: 8, qf: 4, sf: 2, final: 1 };
const GAMES_PER_TEAM: Record<EPhase, number> = { group: 3, r16: 1, qf: 1, sf: 1, final: 1 };

function MiniTable({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
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
              <td key={j} className={`e-num py-1.5 pr-3 last:pr-0 last:text-right ${j === 0 ? "text-ink-100" : "text-ink-300"} ${j === r.length - 1 ? "font-bold text-mint-300" : ""}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function PointsEconomy() {
  // Round pots only — the champion pick is a separate, pre-tournament prediction.
  const rows = PHASES.map((p) => {
    const outcomes = MATCHES_IN_ROUND[p] * outcomePoints(p, 1);
    const scorers = SCORER_PICKS[p] * GAMES_PER_TEAM[p] * scorerPointsPerGoal(p, 1);
    const tokens = TOKENS_BY_PHASE[p] * tokenPoints(p, 1, 1, 0);
    return { phase: p, outcomes, scorers, tokens, total: outcomes + scorers + tokens };
  });
  const max = Math.max(...rows.map((r) => r.total));
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.phase}>
          <div className="mb-1 flex items-baseline justify-between">
            <span className="text-xs font-semibold text-ink-100">{PHASE_LABEL[r.phase]}</span>
            <span className="e-num font-grotesk text-sm font-bold text-white">{fmtPts(r.total)} pts</span>
          </div>
          <div style={{ width: `${Math.max(8, (r.total / max) * 100)}%` }}>
            <BarBreakdown
              items={[
                { key: "outcomes", value: r.outcomes },
                { key: "scorers", value: r.scorers },
                { key: "tokens", value: r.tokens },
              ]}
            />
          </div>
        </div>
      ))}
      <p className="text-[11px] text-ink-500">
        Typical points on offer per round (tokens shown as their ± swing — they can lose as much as they win).
        Each round is worth roughly 1.5× the one before.
      </p>
    </div>
  );
}

export default function Rules() {
  return (
    <div className="space-y-4">
      <PageHead title="How scoring works" sub="Back what you believe. The less likely it is, the more it pays." />

      <section className="e-card p-4">
        <SectionTitle>The one rule</SectionTitle>
        <p className="text-sm text-ink-200">
          Every prediction shows two numbers: <span className="font-bold text-skyx-300">your chance</span> and{" "}
          <span className="font-bold text-mint-300">the points if you're right</span>. Long shots pay more, favourites pay
          less — and on average it evens out, so the only way to climb is to be
          <span className="font-bold text-white"> right when the market is wrong</span>.
        </p>
        <ul className="mt-2 space-y-1 text-xs text-ink-300">
          <li>🔒 Locking freezes your payout, permanently. Prices move until you lock.</li>
          <li>🙈 Unlocked predictions score nothing. Everyone's picks stay hidden until kickoff.</li>
          <li>⏰ A whole round locks before its first game kicks off.</li>
        </ul>
      </section>

      <section className="e-card p-4">
        <SectionTitle hint="every game">Match results</SectionTitle>
        <p className="mb-2 text-sm text-ink-200">
          Pick <span className="font-semibold text-white">home, draw or away</span> for every game in the round.
          Knockouts count the score <span className="font-semibold text-white">after extra time</span> — a draw stands
          and pays; penalties only decide who goes through.
        </p>
        <MiniTable
          head={["Round", "Games", "A coin-flip call pays"]}
          rows={PHASES.map((p) => [PHASE_SHORT[p], MATCHES_IN_ROUND[p], `+${fmtPts(outcomePoints(p, 2))}`])}
        />
      </section>

      <section className="e-card p-4">
        <SectionTitle hint="forwards only">Scorers</SectionTitle>
        <p className="mb-2 text-sm text-ink-200">
          Pick a squad of forwards each round — half as many as there are games. Every goal they score pays out, so a
          brace pays double. Prolific strikers pay less per goal, longshots more.
        </p>
        <MiniTable
          head={["Round", "Picks", "A typical goal pays"]}
          rows={PHASES.map((p) => [PHASE_SHORT[p], SCORER_PICKS[p], `+${fmtPts(scorerPointsPerGoal(p, 2))}`])}
        />
      </section>

      <section className="e-card p-4">
        <SectionTitle hint="the risk lever">Tokens</SectionTitle>
        <p className="mb-2 text-sm text-ink-200">
          Back a team's <span className="font-semibold text-white">winning margin</span>: every token earns points for
          each goal better than expected they finish, and loses the same for each goal worse.
          <span className="font-semibold text-white"> Stack multiple tokens on one game</span> to raise the stakes.
          Favourites are expected to win big, so a scrappy 1–0 can miss — while an underdog that keeps it close pays
          <span className="font-semibold text-white"> even in defeat</span>.
        </p>
        <MiniTable
          head={["Round", "Tokens", "Per goal, per token"]}
          rows={PHASES.map((p) => [PHASE_SHORT[p], TOKENS_BY_PHASE[p], `±${fmtPts(tokenPoints(p, 1, 1, 0))}`])}
        />
        <p className="mt-2 text-xs text-red-300">⚠️ The only market that can go negative — the market is your opponent.</p>
      </section>

      <section className="e-card p-4 ring-1 ring-volt-400/15">
        <SectionTitle hint="one pick, before game one">The champion</SectionTitle>
        <p className="text-sm text-ink-200">
          Separate from the rounds: before the opening match you back
          <span className="font-semibold text-white"> one team to win the whole tournament</span>. Payout scales with how
          bold the call is — a favourite pays around{" "}
          <span className="e-num font-bold text-mint-300">+{fmtPts(championPoints(5))}</span>, a 10%-shot around{" "}
          <span className="e-num font-bold text-mint-300">+{fmtPts(championPoints(10))}</span>, and a true dark horse its
          full price. Enough to shake the podium at the end — not to carry a bad month.
        </p>
      </section>

      <section className="e-card p-4">
        <SectionTitle hint="per round">Where the points live</SectionTitle>
        <PointsEconomy />
        <p className="mt-2 text-xs text-ink-300">
          👑 The champion pick sits on top of all of this — one pre-tournament call worth{" "}
          <span className="e-num font-semibold text-mint-300">{fmtSignedPts(championPoints(5))}</span> or more, settled
          after the final.
        </p>
      </section>
    </div>
  );
}
