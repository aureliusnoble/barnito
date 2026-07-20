import { useState } from "react";
import { ChevronDown, Crown } from "lucide-react";
import type { UserScore } from "../types";
import { useEuro } from "../store/store";
import { fmtOdds, fmtPts, fmtSignedPts } from "../lib/format";
import { BarBreakdown, EmptyState, PageHead, PtsTag } from "../ui/kit";

const MEDALS = ["🥇", "🥈", "🥉"];

export default function Leaderboard() {
  const { scores, state } = useEuro();
  const admins = new Set(state.users.filter((u) => u.isAdmin).map((u) => u.id));
  const ranked = scores.filter((s) => !admins.has(s.userId)).sort((a, b) => a.rank - b.rank);
  const anyPoints = ranked.some((s) => s.total !== 0);

  return (
    <div className="space-y-3">
      <PageHead title="Leaderboard" sub="Totals across results, scorers, tokens and the champion pick." />
      {!anyPoints && <EmptyState emoji="⏱️">No points yet — scores land when matches finish.</EmptyState>}
      {ranked.map((s) => (
        <Row key={s.userId} s={s} />
      ))}
    </div>
  );
}

function Row({ s }: { s: UserScore }) {
  const { state, teamById, playerById, fixtureById } = useEuro();
  const [open, setOpen] = useState(false);
  const user = state.users.find((u) => u.id === s.userId);
  const teamName = (id: string | null | undefined) => (id ? teamById.get(id)?.code ?? id : "?");
  const fixtureLabel = (fid: string) => {
    const f = fixtureById.get(fid);
    return f ? `${teamName(f.homeTeamId)} v ${teamName(f.awayTeamId)}` : fid;
  };
  const scoredOutcomes = s.outcomeLines.filter((l) => l.points > 0).slice(-3).reverse();
  const scoredScorers = s.scorerLines.filter((l) => l.goals > 0).slice(-3).reverse();
  const scoredTokens = s.tokenLines.filter((l) => l.points !== 0).slice(-3).reverse();

  return (
    <div className="e-card overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 p-3.5 text-left">
        <span className="w-8 shrink-0 text-center font-grotesk text-lg font-extrabold text-ink-300">
          {s.rank >= 1 && s.rank <= 3 ? MEDALS[s.rank - 1] : s.rank}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 truncate font-semibold text-white">
            <span>{user?.emoji}</span> {s.name}
            {s.championCorrect && (
              <span className="e-chip bg-volt-400/15 text-volt-300 ring-1 ring-volt-400/30">
                <Crown size={10} /> +{fmtPts(s.champion)}
              </span>
            )}
          </span>
        </span>
        <span className="e-num font-grotesk text-xl font-extrabold text-white">{fmtPts(s.total)}</span>
        <ChevronDown size={16} className={`shrink-0 text-ink-500 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-white/[0.05] p-3.5 pt-3">
          <BarBreakdown
            items={[
              { key: "outcomes", value: s.outcomes },
              { key: "scorers", value: s.scorers },
              { key: "tokens", value: s.tokens },
              { key: "champion", value: s.champion },
            ]}
          />
          {s.tokens < 0 && (
            <p className="text-[11px] text-red-300">Tokens are net negative ({fmtSignedPts(s.tokens)}) — backed teams lost by more than they won.</p>
          )}
          {scoredOutcomes.length > 0 && (
            <MiniList title="Recent results">
              {scoredOutcomes.map((l, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-ink-300">{fixtureLabel(l.fixtureId)} · {l.pick}</span>
                  <span className="flex items-center gap-1.5">
                    <span className="e-num text-punch-300">×{fmtOdds(l.odds)}</span>
                    <PtsTag pts={l.points} signed />
                  </span>
                </li>
              ))}
            </MiniList>
          )}
          {scoredScorers.length > 0 && (
            <MiniList title="Scorer hits">
              {scoredScorers.map((l, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-ink-300">
                    {playerById.get(l.playerId)?.name ?? l.playerId} · {l.goals}⚽
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="e-num text-punch-300">×{fmtOdds(l.odds)}</span>
                    <PtsTag pts={l.points} signed />
                  </span>
                </li>
              ))}
            </MiniList>
          )}
          {scoredTokens.length > 0 && (
            <MiniList title="Token swings">
              {scoredTokens.map((l, i) => (
                <li key={i} className="flex items-center justify-between">
                  <span className="text-ink-300">
                    {l.count}🪙 {teamById.get(l.teamId)?.name ?? l.teamId} · margin {l.netDiff > 0 ? "+" : ""}
                    {l.netDiff} vs line {l.spread > 0 ? "+" : ""}{l.spread.toFixed(1)}
                  </span>
                  <PtsTag pts={l.points} signed />
                </li>
              ))}
            </MiniList>
          )}
        </div>
      )}
    </div>
  );
}

function MiniList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-ink-500">{title}</div>
      <ul className="space-y-1 text-xs">{children}</ul>
    </div>
  );
}
