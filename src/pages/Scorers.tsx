import { useMemo, useState } from "react";
import { Goal, Trophy, Users, AlertTriangle } from "lucide-react";
import { useBarnito, useHelpers } from "../data/store";
import { SectionTitle, Crest } from "../components/bits";
import { Avatar } from "../components/visuals";
import { POSITION_LABEL } from "../lib/format";
import type { Position } from "@shared/types";

const POS_COLOR: Record<Position, string> = {
  GK: "bg-purple-500/20 text-purple-300",
  DEF: "bg-sky-500/20 text-sky-300",
  MID: "bg-accent-500/20 text-accent-300",
  FWD: "bg-spice-500/20 text-spice-300",
};

type View = "people" | "boot" | "players";

export default function Scorers() {
  const [view, setView] = useState<View>("people");
  return (
    <div className="space-y-4">
      <SectionTitle icon={<Goal size={18} className="text-accent-400" />} hint="32 DEF/GK · 16 MID · 8 FWD per goal">
        Goal scorers
      </SectionTitle>
      <div className="flex gap-1.5">
        <Toggle on={view === "people"} onClick={() => setView("people")} icon={<Users size={14} />}>
          Picks
        </Toggle>
        <Toggle on={view === "boot"} onClick={() => setView("boot")} icon={<Trophy size={14} />}>
          Golden Boot
        </Toggle>
        <Toggle on={view === "players"} onClick={() => setView("players")} icon={<Goal size={14} />}>
          Most-picked
        </Toggle>
      </div>
      {view === "people" ? <ByPerson /> : view === "boot" ? <GoldenBoot /> : <ByPlayer />}
    </div>
  );
}

function Toggle({
  on,
  onClick,
  icon,
  children,
}: {
  on: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`chip gap-1.5 px-3 py-1.5 transition ${
        on ? "bg-accent-500 text-pitch-950" : "bg-pitch-800/70 text-pitch-300 hover:text-white"
      }`}
    >
      {icon}
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
  const { scores, participantById, playerById, injuryByPlayerId } = useBarnito();
  const { teamName } = useHelpers();
  const ordered = [...scores.scorerView].sort((a, b) => b.total - a.total);

  return (
    <div className="space-y-3">
      {ordered.map((sv) => {
        const champ = participantById.get(sv.participantId)?.champion;
        return (
          <div key={sv.participantId} className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="font-display font-bold text-white">{sv.name}</span>
                {champ && (
                  <span className="chip gap-1 bg-pitch-800/70 text-pitch-300" title="Champion pick">
                    👑 <Crest teamId={champ} size={13} />
                  </span>
                )}
              </div>
              <span className="font-display text-lg font-extrabold tabular-nums text-white">
                {sv.total}
              </span>
            </div>
            <ul className="divide-y divide-white/[0.04]">
              {sv.picks.map((p) => {
                const player = playerById.get(p.playerId);
                const injury = injuryByPlayerId.get(p.playerId);
                return (
                  <li key={p.playerId} className="flex items-center gap-2.5 px-3 py-2 text-sm">
                    <Avatar photo={player?.photo} name={p.playerName} position={p.position} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5">
                        <span className="truncate text-pitch-100">{p.playerName}</span>
                        {injury && (
                          <span title={`${injury.type}: ${injury.reason}`} className="shrink-0">
                            <AlertTriangle size={13} className="text-spice-400" />
                          </span>
                        )}
                      </span>
                      <span className="flex items-center gap-1 text-[11px] text-pitch-500">
                        <Crest teamId={p.teamId} size={11} /> {teamName(p.teamId)}
                      </span>
                    </span>
                    <PosChip position={p.position} />
                    <span className="w-9 text-right text-pitch-300">
                      {p.goals}
                      <span className="text-[10px] text-pitch-500"> gl</span>
                    </span>
                    <span className="w-10 text-right font-bold tabular-nums text-white">{p.points}</span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

function GoldenBoot() {
  const { stats, scores } = useBarnito();
  const pickedIds = useMemo(() => {
    const s = new Set<string>();
    for (const sv of scores.scorerView) for (const p of sv.picks) s.add(p.playerId);
    return s;
  }, [scores]);

  if (stats.topScorers.length === 0) {
    return (
      <p className="card p-6 text-center text-sm text-pitch-400">
        The tournament top-scorer race appears once live data is flowing.
      </p>
    );
  }
  const podium = stats.topScorers.slice(0, 3);
  const rest = stats.topScorers.slice(3);
  const medal = ["text-yellow-400", "text-pitch-300", "text-spice-400"];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {podium.map((p, i) => (
          <div key={p.apiId ?? p.name} className="card flex flex-col items-center gap-1.5 p-3 text-center">
            <Trophy size={16} className={medal[i]} />
            <Avatar photo={p.photo} name={p.name} position={p.position ?? null} size={44} />
            <span className="truncate text-xs font-semibold text-white" title={p.name}>{p.name}</span>
            {p.teamId && (
              <span className="flex items-center gap-1 text-[10px] text-pitch-500">
                <Crest teamId={p.teamId} size={11} /> {p.teamName}
              </span>
            )}
            <span className="font-display text-xl font-extrabold text-white">{p.value}</span>
            {p.playerId && pickedIds.has(p.playerId) && (
              <span className="chip bg-accent-500/20 text-accent-300">picked 🎯</span>
            )}
          </div>
        ))}
      </div>
      <ul className="card divide-y divide-white/[0.04] overflow-hidden">
        {rest.map((p, i) => (
          <li key={p.apiId ?? p.name} className="flex items-center gap-2.5 px-3 py-2 text-sm">
            <span className="w-5 text-center font-mono text-xs text-pitch-500">{i + 4}</span>
            <Avatar photo={p.photo} name={p.name} position={p.position ?? null} size={26} />
            <span className="min-w-0 flex-1 truncate text-pitch-100">{p.name}</span>
            {p.teamId && <Crest teamId={p.teamId} size={14} />}
            {p.playerId && pickedIds.has(p.playerId) && <span title="Picked">🎯</span>}
            <span className="w-8 text-right font-bold tabular-nums text-white">{p.value}</span>
          </li>
        ))}
      </ul>
      <p className="px-1 text-[11px] text-pitch-500">Goals across the whole tournament · 🎯 = picked by someone.</p>
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
  const { scores, playerById } = useBarnito();
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
      {aggregated.map((a) => {
        const player = playerById.get(a.playerId);
        return (
          <div key={a.playerId} className="card flex items-center gap-2.5 p-3 text-sm">
            <Avatar photo={player?.photo} name={a.playerName} position={a.position} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-white">{a.playerName}</span>
                <PosChip position={a.position} />
              </div>
              <div className="flex items-center gap-1 truncate text-[11px] text-pitch-400">
                <Crest teamId={a.teamId} size={11} /> {teamName(a.teamId)} · picked by {a.pickedBy.join(", ")}
              </div>
            </div>
            <div className="text-right">
              <div className="font-bold tabular-nums text-white">{a.goals} ⚽</div>
              <div className="text-[10px] text-pitch-500">
                ×{a.pickedBy.length} {a.pickedBy.length === 1 ? "pick" : "picks"}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
