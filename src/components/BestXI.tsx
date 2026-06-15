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
  minutes: number;
  score: number; // avg rating, weighted by minutes played (diminishing returns)
}

// API lineup position letter → our position category.
const POS_OF: Record<string, Position> = { G: "GK", D: "DEF", M: "MID", F: "FWD" };
const ORDER: Position[] = ["GK", "DEF", "MID", "FWD"];

/** Most-common formation seen in the lineups so far, as outfield-line counts e.g. [4,2,3,1]. */
function modeFormation(segsList: string[]): { label: string; segs: number[] } {
  const count = new Map<string, number>();
  for (const f of segsList) count.set(f, (count.get(f) ?? 0) + 1);
  const label = [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? "4-3-3";
  const segs = label.split("-").map(Number).filter((n) => n > 0);
  return { label, segs: segs.length >= 3 ? segs : [4, 3, 3] };
}

function XIToken({ p, x, y, onOpen }: { p: XIPlayer; x: number; y: number; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ left: `${x}%`, top: `${y}%` }}
      title={`${p.name} · ${p.avg.toFixed(2)} avg over ${p.apps} ${p.apps === 1 ? "game" : "games"} (${p.minutes}′)`}
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

  const { rows, label } = useMemo(() => {
    // 1) average match rating per player + 2) which line(s) they've actually started in.
    const agg = new Map<string, { sum: number; n: number; min: number; name: string; teamId: string }>();
    const eligible = new Map<string, Set<Position>>();
    const formations: string[] = [];
    for (const m of matches.matches) {
      for (const r of m.ratings ?? []) {
        if (!r.playerId || r.rating == null) continue;
        const a = agg.get(r.playerId) ?? { sum: 0, n: 0, min: 0, name: r.name, teamId: r.teamId };
        a.sum += r.rating; a.n += 1; a.min += r.minutes ?? 0; a.name = r.name; a.teamId = r.teamId;
        agg.set(r.playerId, a);
      }
      for (const l of m.lineups ?? []) {
        if (l.formation) formations.push(l.formation);
        for (const p of l.startXI) {
          const cat = p.pos ? POS_OF[p.pos] : null;
          if (p.playerId && cat) (eligible.get(p.playerId) ?? eligible.set(p.playerId, new Set()).get(p.playerId)!).add(cat);
        }
      }
    }

    const draft = [...agg.entries()].map(([playerId, a]) => {
      const roster = playerById.get(playerId);
      // minutes coverage can be missing; fall back to ~a full game per appearance
      const minutes = a.min > 0 ? a.min : a.n * 90;
      return {
        playerId, name: a.name, teamId: a.teamId,
        photo: roster?.photo ?? null,
        position: roster?.position ?? ("MID" as Position),
        avg: a.sum / a.n, apps: a.n, minutes,
      };
    });
    // Weight the average rating by minutes played on a log curve, so a sustained run of games
    // outranks a single high-scoring cameo — but with diminishing returns (the most-played player
    // sets the ceiling at weight 1.0).
    const maxMin = Math.max(1, ...draft.map((p) => p.minutes));
    const players: XIPlayer[] = draft.map((p) => ({
      ...p,
      score: p.avg * (Math.log1p(p.minutes) / Math.log1p(maxMin)),
    }));
    // A player can fill any line they've started in, plus their nominal position ("or similar").
    const eligOf = (p: XIPlayer) => {
      const s = new Set(eligible.get(p.playerId) ?? []);
      s.add(p.position);
      return s;
    };

    // formation → slot counts (first line = DEF, last = FWD, anything between = MID)
    const { label, segs } = modeFormation(formations);
    const need: Record<Position, number> = {
      GK: 1, DEF: segs[0], FWD: segs[segs.length - 1],
      MID: segs.slice(1, -1).reduce((s, n) => s + n, 0),
    };
    const filled: Record<Position, XIPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };

    const sorted = players.slice().sort((a, b) => b.score - a.score || b.minutes - a.minutes);
    const used = new Set<string>();
    const placeInto = (cats: (p: XIPlayer) => Position[]) => {
      for (const p of sorted) {
        if (used.has(p.playerId)) continue;
        const open = cats(p).filter((c) => filled[c].length < need[c]);
        if (open.length === 0) continue;
        // keep players in their natural role when possible, else fill the scarcest open line
        const choice = open.includes(p.position)
          ? p.position
          : open.sort((a, b) => (need[a] - filled[a].length) - (need[b] - filled[b].length))[0];
        filled[choice].push(p); used.add(p.playerId);
      }
    };
    // pass 1: only lines the player is eligible for; pass 2: relax to fill any gaps
    placeInto((p) => ORDER.filter((c) => eligOf(p).has(c)));
    placeInto(() => ORDER);

    // lay out by the real formation rows: GK, DEF, [mid lines…], FWD
    const mid = filled.MID;
    const midSegs = segs.slice(1, -1);
    const midRows: XIPlayer[][] = [];
    let mi = 0;
    for (const cnt of midSegs) { midRows.push(mid.slice(mi, mi + cnt)); mi += cnt; }
    const rows = [filled.GK, filled.DEF, ...midRows, filled.FWD].filter((r) => r.length > 0);
    return { rows, label };
  }, [matches, playerById]);

  const count = rows.reduce((n, l) => n + l.length, 0);
  if (count === 0) {
    return <p className="card p-6 text-center text-sm text-pitch-400">The Team of the Tournament appears once match ratings start coming in.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-sm text-pitch-400">
        Best match rating per position (weighted by minutes played), in the tournament's most-used shape (<span className="font-semibold text-pitch-200">{label}</span>).
        Players are eligible for any line they've started in. Tap a player for their card.
      </p>
      <div
        className="relative mx-auto w-full max-w-[22rem] overflow-hidden rounded-2xl shadow-[inset_0_0_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
        style={{ aspectRatio: "68 / 105" }}
      >
        <PitchMarkings />
        {rows.flatMap((line, li) =>
          line.map((p, i) => {
            const y = 90 - (li / (rows.length - 1)) * 80; // GK (li=0) at the bottom
            const x = 10 + ((i + 0.5) / line.length) * 80;
            return <XIToken key={p.playerId} p={p} x={x} y={y} onOpen={() => open(p.playerId)} />;
          }),
        )}
      </div>
    </div>
  );
}
