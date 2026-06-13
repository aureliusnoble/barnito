import { useMemo, useState } from "react";
import { useBarnito, useHelpers } from "../data/store";
import { SectionTitle } from "../components/bits";
import { flagEmoji, POSITION_LABEL } from "../lib/format";
import type { Position } from "@shared/types";

const POS_COLOR: Record<Position, string> = {
  GK: "bg-purple-500/20 text-purple-300",
  DEF: "bg-blue-500/20 text-blue-300",
  MID: "bg-emerald-500/20 text-emerald-300",
  FWD: "bg-spice-500/20 text-spice-400",
};

export default function Scorers() {
  const [view, setView] = useState<"people" | "players">("people");
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionTitle hint="32 DEF/GK · 16 MID · 8 FWD per goal">Goal scorers</SectionTitle>
      </div>
      <div className="flex gap-1.5">
        <Toggle on={view === "people"} onClick={() => setView("people")}>
          Players' picks
        </Toggle>
        <Toggle on={view === "players"} onClick={() => setView("players")}>
          Most-picked
        </Toggle>
      </div>
      {view === "people" ? <ByPerson /> : <ByPlayer />}
    </div>
  );
}

function Toggle({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`chip px-3 py-1.5 transition ${
        on ? "bg-pitch-600 text-white" : "bg-pitch-800/70 text-pitch-300 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}

function PosChip({ position }: { position: Position }) {
  return (
    <span className={`chip ${POS_COLOR[position]}`} title={POSITION_LABEL[position]}>
      {position}
    </span>
  );
}

function ByPerson() {
  const { scores, participantById } = useBarnito();
  const { teamName } = useHelpers();
  // sort participants by scorer total desc
  const ordered = [...scores.scorerView].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-3">
      {ordered.map((sv) => {
        const champ = participantById.get(sv.participantId)?.champion;
        return (
          <div key={sv.participantId} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-pitch-800/60 px-3 py-2">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold">{sv.name}</span>
                {champ && (
                  <span className="chip bg-pitch-800/70 text-pitch-300" title="Champion pick">
                    👑 {flagEmoji(teamName(champ))}
                  </span>
                )}
              </div>
              <span className="font-display text-lg font-extrabold tabular-nums text-pitch-100">
                {sv.total}
              </span>
            </div>
            <ul className="divide-y divide-pitch-800/40">
              {sv.picks.map((p) => (
                <li key={p.playerId} className="flex items-center gap-2 px-3 py-2 text-sm">
                  <span className="text-base">{flagEmoji(teamName(p.teamId))}</span>
                  <span className="min-w-0 flex-1 truncate">{p.playerName}</span>
                  <PosChip position={p.position} />
                  <span className="w-12 text-right text-pitch-300">
                    {p.goals} <span className="text-[10px] text-pitch-500">gl</span>
                  </span>
                  <span className="w-12 text-right font-bold tabular-nums">{p.points}</span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

interface Agg {
  playerId: string;
  playerName: string;
  teamId: string;
  position: Position;
  goals: number;
  pickedBy: string[];
}

function ByPlayer() {
  const { scores } = useBarnito();
  const { teamName } = useHelpers();

  const aggregated = useMemo(() => {
    const map = new Map<string, Agg>();
    for (const sv of scores.scorerView) {
      for (const pick of sv.picks) {
        const a = map.get(pick.playerId) ?? {
          playerId: pick.playerId,
          playerName: pick.playerName,
          teamId: pick.teamId,
          position: pick.position,
          goals: pick.goals,
          pickedBy: [],
        };
        a.pickedBy.push(sv.name);
        map.set(pick.playerId, a);
      }
    }
    return [...map.values()].sort(
      (a, b) => b.pickedBy.length - a.pickedBy.length || b.goals - a.goals,
    );
  }, [scores]);

  return (
    <div className="space-y-2">
      {aggregated.map((a) => (
        <div key={a.playerId} className="card flex items-center gap-2 p-3 text-sm">
          <span className="text-base">{flagEmoji(teamName(a.teamId))}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate font-semibold">{a.playerName}</span>
              <PosChip position={a.position} />
            </div>
            <div className="truncate text-[11px] text-pitch-400">
              picked by {a.pickedBy.join(", ")}
            </div>
          </div>
          <div className="text-right">
            <div className="font-bold tabular-nums">{a.goals} ⚽</div>
            <div className="text-[10px] text-pitch-500">
              ×{a.pickedBy.length} {a.pickedBy.length === 1 ? "pick" : "picks"}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
