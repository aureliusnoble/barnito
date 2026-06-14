import { useMemo } from "react";
import { useBarnito } from "../data/store";
import { usePlayerModal } from "./PlayerModal";
import { Avatar } from "./visuals";
import { Crest } from "./bits";
import { PitchMarkings, lastName } from "./Pitch";
import type { Position } from "@shared/types";

interface XIPlayer {
  playerId: string;
  name: string;
  teamId: string;
  photo: string | null;
  position: Position;
  avg: number;
  apps: number;
}

const FORMATION: { pos: Position; n: number }[] = [
  { pos: "GK", n: 1 },
  { pos: "DEF", n: 4 },
  { pos: "MID", n: 3 },
  { pos: "FWD", n: 3 },
];

function XIToken({ p, x, y, onOpen }: { p: XIPlayer; x: number; y: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ left: `${x}%`, top: `${y}%` }}
      title={`${p.name} · ${p.avg.toFixed(2)} avg over ${p.apps} ${p.apps === 1 ? "game" : "games"}`}
      className="absolute flex w-[24%] -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-0.5"
    >
      <span className="relative">
        <Avatar photo={p.photo} name={p.name} position={p.position} size={36} />
        <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 rounded-full bg-accent-500 px-1 text-[8px] font-bold text-pitch-950 ring-1 ring-pitch-950/50">
          {p.avg.toFixed(1)}
        </span>
      </span>
      <span className="flex max-w-full items-center gap-0.5 truncate rounded-sm bg-pitch-950/70 px-1 text-[8.5px] font-medium text-white">
        <Crest teamId={p.teamId} size={9} />
        {lastName(p.name)}
      </span>
    </button>
  );
}

export default function BestXI() {
  const { matches, playerById } = useBarnito();
  const { open } = usePlayerModal();

  const lines = useMemo(() => {
    const agg = new Map<string, { sum: number; n: number; name: string; teamId: string }>();
    for (const m of matches.matches) {
      for (const r of m.ratings ?? []) {
        if (!r.playerId || r.rating == null) continue;
        const a = agg.get(r.playerId) ?? { sum: 0, n: 0, name: r.name, teamId: r.teamId };
        a.sum += r.rating;
        a.n += 1;
        a.name = r.name;
        a.teamId = r.teamId;
        agg.set(r.playerId, a);
      }
    }
    const players: XIPlayer[] = [...agg.entries()].map(([playerId, a]) => {
      const roster = playerById.get(playerId);
      return {
        playerId,
        name: a.name,
        teamId: a.teamId,
        photo: roster?.photo ?? null,
        position: roster?.position ?? "MID",
        avg: a.sum / a.n,
        apps: a.n,
      };
    });

    const used = new Set<string>();
    const pick = (pos: Position, n: number) => {
      const out = players.filter((p) => p.position === pos && !used.has(p.playerId)).sort((x, y) => y.avg - x.avg).slice(0, n);
      out.forEach((p) => used.add(p.playerId));
      return out;
    };
    const out = FORMATION.map(({ pos, n }) => pick(pos, n));
    // backfill any short line from the best remaining players
    const rest = players.filter((p) => !used.has(p.playerId)).sort((x, y) => y.avg - x.avg);
    out.forEach((line, i) => {
      while (line.length < FORMATION[i].n && rest.length) {
        const p = rest.shift()!;
        used.add(p.playerId);
        line.push(p);
      }
    });
    return out; // [GK, DEF, MID, FWD]
  }, [matches, playerById]);

  const count = lines.reduce((n, l) => n + l.length, 0);
  if (count === 0) {
    return <p className="card p-6 text-center text-sm text-pitch-400">The Team of the Tournament appears once match ratings start coming in.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-sm text-pitch-400">Highest average match rating by position, in a 4‑3‑3. Tap a player for their card.</p>
      <div
        className="relative mx-auto w-full max-w-[22rem] overflow-hidden rounded-2xl shadow-[inset_0_0_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
        style={{ aspectRatio: "68 / 105" }}
      >
        <PitchMarkings />
        {lines.flatMap((line, li) =>
          line.map((p, i) => {
            const y = 90 - (li / (lines.length - 1)) * 80; // GK (li=0) at the bottom
            const x = 10 + ((i + 0.5) / line.length) * 80;
            return <XIToken key={p.playerId} p={p} x={x} y={y} onOpen={() => open(p.playerId)} />;
          }),
        )}
      </div>
    </div>
  );
}
