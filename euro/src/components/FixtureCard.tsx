// Browse-mode fixture card: kickoff, score, scorers, spice, your locked pick.
// Tapping "Details" opens the full match card (team info, picks, token stakes).

import { useState } from "react";
import { Link } from "react-router-dom";
import { Info, MapPin, Target } from "lucide-react";
import type { EFixture } from "../types";
import { PHASE_SHORT } from "../config";
import { useEuro } from "../store/store";
import { spiceLevel } from "../lib/spice";
import { fmtDay, fmtTime } from "../lib/format";
import { CountdownPill, SpiceTag, TeamMark } from "../ui/kit";
import FixtureModal from "./FixtureModal";

export default function FixtureCard({ fixture }: { fixture: EFixture }) {
  const { me, nowMs, teamById, playerById, state, fixtureStarted, canPredictFixture, spiceOf } = useEuro();
  const [detailOpen, setDetailOpen] = useState(false);

  const home = fixture.homeTeamId ? teamById.get(fixture.homeTeamId) : undefined;
  const away = fixture.awayTeamId ? teamById.get(fixture.awayTeamId) : undefined;
  const finished = fixture.status === "FINISHED";
  const started = fixtureStarted(fixture);
  const myPred = me ? state.predictions[me.id]?.outcomes[fixture.id] : undefined;
  const spice = finished ? 0 : spiceOf(fixture);
  const level = spiceLevel(spice);

  const optionLabel = (o: "H" | "D" | "A") => (o === "H" ? home?.code ?? "H" : o === "A" ? away?.code ?? "A" : "DRAW");

  return (
    <div className="e-card p-3.5">
      <div className="mb-2 flex items-center justify-between text-[11px] text-ink-400">
        <span className="flex items-center gap-1.5">
          <span className="e-chip bg-white/[0.05] text-ink-300 ring-1 ring-white/[0.06]">
            {PHASE_SHORT[fixture.phase]}
            {fixture.group ? ` · ${fixture.group}` : ""}
          </span>
          {fmtDay(fixture.kickoff)} · {fmtTime(fixture.kickoff)}
          <span className="hidden items-center gap-0.5 sm:inline-flex">
            <MapPin size={10} />
            {fixture.venue}
          </span>
        </span>
        <span className="flex items-center gap-1.5">
          <SpiceTag level={level} />
          {finished ? (
            <span className="e-chip bg-white/[0.06] text-ink-200 ring-1 ring-white/[0.08]">Full time</span>
          ) : started ? (
            <span className="e-chip bg-punch-500/15 text-punch-300 ring-1 ring-punch-500/25">Kicked off</span>
          ) : (
            <CountdownPill toIso={fixture.kickoff} nowMs={nowMs} />
          )}
        </span>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          {home ? <TeamMark team={home} /> : <span className="text-sm text-ink-400">{fixture.homeLabel ?? "TBD"}</span>}
          {fixture.homeGoals != null && <span className="e-num font-grotesk text-lg font-extrabold text-white">{fixture.homeGoals}</span>}
        </div>
        <div className="flex items-center justify-between">
          {away ? <TeamMark team={away} /> : <span className="text-sm text-ink-400">{fixture.awayLabel ?? "TBD"}</span>}
          {fixture.awayGoals != null && <span className="e-num font-grotesk text-lg font-extrabold text-white">{fixture.awayGoals}</span>}
        </div>
      </div>
      {finished && fixture.penWinnerTeamId && (
        <div className="mt-1 text-[11px] text-punch-300">{teamById.get(fixture.penWinnerTeamId)?.name} win on penalties</div>
      )}
      {finished && fixture.scorers.length > 0 && (
        <div className="mt-1 text-[11px] text-ink-400">
          ⚽ {fixture.scorers.map((s) => `${playerById.get(s.playerId)?.name ?? s.playerId}${s.count > 1 ? ` ×${s.count}` : ""}`).join(", ")}
        </div>
      )}

      {/* my pick / call to action / details */}
      <div className="mt-2 flex items-center justify-between gap-2">
        {myPred?.locked ? (
          <span className="e-chip bg-volt-400/15 text-volt-300 ring-1 ring-volt-400/25">🔒 your pick: {optionLabel(myPred.pick)}</span>
        ) : canPredictFixture(fixture) && !me?.isAdmin ? (
          <Link to="/picks/matches" className="inline-flex items-center gap-1 text-xs font-semibold text-volt-300 hover:text-volt-200">
            <Target size={12} /> Predict this match →
          </Link>
        ) : (
          <span />
        )}
        <button onClick={() => setDetailOpen(true)} className="flex items-center gap-1 text-xs font-semibold text-ink-300 hover:text-white">
          <Info size={13} /> Details
        </button>
      </div>
      {detailOpen && <FixtureModal fixture={fixture} onClose={() => setDetailOpen(false)} />}
    </div>
  );
}
