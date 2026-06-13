import { useBarnito, useHelpers } from "../data/store";
import { Crest } from "./bits";
import { formatDay, formatTime } from "../lib/format";
import type { BracketMatch } from "@shared/types";

const CANONICAL = [
  { name: "Round of 32", count: 16 },
  { name: "Round of 16", count: 8 },
  { name: "Quarter-finals", count: 4 },
  { name: "Semi-finals", count: 2 },
  { name: "Final", count: 1 },
];

export default function Bracket() {
  const { bracket } = useBarnito();
  const hasData = bracket.rounds.some((r) => r.matches.length > 0);

  if (!hasData) {
    return (
      <div className="space-y-3">
        <div className="card flex items-center gap-3 p-4">
          <span className="text-2xl">🏆</span>
          <div className="text-sm text-pitch-300">
            The knockout bracket fills in here as fixtures are confirmed — after the group stage
            (from <span className="text-white">28 June</span>).
          </div>
        </div>
        <div className="space-y-2">
          {CANONICAL.map((r) => (
            <div key={r.name} className="card flex items-center justify-between px-4 py-3">
              <span className="font-display font-bold text-white">{r.name}</span>
              <span className="text-xs text-pitch-500">{r.count} {r.count === 1 ? "match" : "matches"} · TBC</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {bracket.rounds.map((round) => (
        <section key={round.name}>
          <h3 className="mb-2 px-1 font-display text-sm font-bold uppercase tracking-wide text-pitch-300">
            {round.name}
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {round.matches.map((m) => (
              <BracketCard key={m.apiId ?? `${round.name}-${m.homeName}-${m.awayName}`} m={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Side({ teamId, name, goals, won }: { teamId: string | null; name?: string | null; goals: number | null; won: boolean }) {
  const { teamName } = useHelpers();
  return (
    <div className={`flex items-center justify-between gap-2 ${won ? "text-white" : "text-pitch-300"}`}>
      <span className="flex min-w-0 items-center gap-2">
        {teamId ? (
          <Crest teamId={teamId} size={18} />
        ) : (
          <span className="grid h-[18px] w-[18px] place-items-center rounded-full border border-dashed border-pitch-600 text-[9px] text-pitch-600">?</span>
        )}
        <span className={`truncate text-sm ${won ? "font-bold" : ""} ${!teamId ? "italic text-pitch-500" : ""}`}>
          {teamId ? teamName(teamId) : name ?? "TBC"}
        </span>
      </span>
      {goals != null && <span className="font-display tabular-nums">{goals}</span>}
    </div>
  );
}

function BracketCard({ m }: { m: BracketMatch }) {
  const hasScore = m.homeGoals != null && m.awayGoals != null;
  return (
    <div className="card space-y-1.5 p-3">
      <div className="flex items-center justify-between text-[10px] text-pitch-500">
        <span>{m.kickoff ? `${formatDay(m.kickoff)} · ${formatTime(m.kickoff)}` : "TBC"}</span>
        {m.status === "FINISHED" && <span className="chip bg-pitch-700 text-pitch-300">FT</span>}
        {(m.status === "LIVE" || m.status === "HT") && <span className="chip bg-red-500 text-white">LIVE</span>}
      </div>
      <Side teamId={m.homeTeamId} name={m.homeName} goals={m.homeGoals} won={hasScore && m.homeGoals! > m.awayGoals!} />
      <Side teamId={m.awayTeamId} name={m.awayName} goals={m.awayGoals} won={hasScore && m.awayGoals! > m.homeGoals!} />
    </div>
  );
}
