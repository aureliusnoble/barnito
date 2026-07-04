import { useMemo } from "react";
import { ArrowUp } from "lucide-react";
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

// Legitimate outfield shapes (DEF-MID-FWD, always 10 outfield + 1 GK). We pick whichever of these
// yields the highest total rating, so e.g. two standout forwards can both start in a 3- or 4-forward
// shape rather than being forced out by a fixed formation. Restricted to real formations only.
const FORMATIONS: { d: number; m: number; f: number }[] = [
  { d: 3, m: 5, f: 2 }, { d: 3, m: 4, f: 3 },
  { d: 4, m: 5, f: 1 }, { d: 4, m: 4, f: 2 }, { d: 4, m: 3, f: 3 },
  { d: 5, m: 4, f: 1 }, { d: 5, m: 3, f: 2 }, { d: 5, m: 2, f: 3 },
];

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
      <span className="mt-1 flex max-w-full items-center gap-0.5 truncate rounded-sm bg-pitch-950/70 px-1 text-[8.5px] font-medium text-white">
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
    // 1) average match rating per player + 2) the line they've most often started in + 3) lateral spot.
    const agg = new Map<string, { sum: number; n: number; min: number; name: string; teamId: string }>();
    const startCount = new Map<string, Record<Position, number>>(); // times started in each line
    const lat = new Map<string, { sum: number; n: number }>(); // typical lateral position, 0=left … 1=right
    for (const m of matches.matches) {
      for (const r of m.ratings ?? []) {
        if (!r.playerId || r.rating == null) continue;
        const a = agg.get(r.playerId) ?? { sum: 0, n: 0, min: 0, name: r.name, teamId: r.teamId };
        a.sum += r.rating; a.n += 1; a.min += r.minutes ?? 0; a.name = r.name; a.teamId = r.teamId;
        agg.set(r.playerId, a);
      }
      for (const l of m.lineups ?? []) {
        const rowSize = new Map<number, number>(); // players per grid row, to normalise the column
        for (const p of l.startXI) if (p.grid) { const r = Number(p.grid.split(":")[0]); rowSize.set(r, (rowSize.get(r) ?? 0) + 1); }
        for (const p of l.startXI) {
          const cat = p.pos ? POS_OF[p.pos] : null;
          if (p.playerId && cat) {
            const c = startCount.get(p.playerId) ?? { GK: 0, DEF: 0, MID: 0, FWD: 0 };
            c[cat] += 1; startCount.set(p.playerId, c);
          }
          if (p.playerId && p.grid) {
            const [r, c] = p.grid.split(":").map(Number);
            const lateral = (c - 0.5) / (rowSize.get(r) ?? 1); // lower column = left, matching the match pitch
            const e = lat.get(p.playerId) ?? { sum: 0, n: 0 };
            e.sum += lateral; e.n += 1; lat.set(p.playerId, e);
          }
        }
      }
    }

    const draft = [...agg.entries()].map(([playerId, a]) => {
      const roster = playerById.get(playerId);
      // minutes coverage can be missing; fall back to ~a full game per appearance
      const minutes = a.min > 0 ? a.min : a.n * 90;
      // Bucket by the line they've most often actually started in; fall back to nominal position.
      const sc = startCount.get(playerId);
      const started = sc ? ORDER.reduce((best, k) => (sc[k] > sc[best] ? k : best), "GK" as Position) : null;
      const position = started && sc && sc[started] > 0 ? started : roster?.position ?? ("MID" as Position);
      return { playerId, name: a.name, teamId: a.teamId, photo: roster?.photo ?? null, position, avg: a.sum / a.n, apps: a.n, minutes };
    });
    // Weight the average rating by minutes played on a log curve, so a sustained run of games
    // outranks a single high-scoring cameo — but with diminishing returns. The most-played player
    // sets the ceiling at weight 1.0; players whose teams went out early simply have fewer minutes
    // and naturally fade, which is what we want.
    const maxMin = Math.max(1, ...draft.map((p) => p.minutes));
    const players: XIPlayer[] = draft.map((p) => ({
      ...p,
      score: p.avg * (Math.log1p(p.minutes) / Math.log1p(maxMin)),
    }));

    // Best players per line (by weighted score), then choose the legitimate formation whose eleven
    // sum highest — i.e. the shape that maximises the average rating (all shapes field exactly 11).
    const byPos: Record<Position, XIPlayer[]> = { GK: [], DEF: [], MID: [], FWD: [] };
    for (const p of players) byPos[p.position].push(p);
    for (const k of ORDER) byPos[k].sort((a, b) => b.score - a.score || b.minutes - a.minutes);
    const gk = byPos.GK[0];

    type Pick = { d: number; m: number; f: number; def: XIPlayer[]; mid: XIPlayer[]; fwd: XIPlayer[]; total: number };
    let best: Pick | null = null;
    for (const { d, m, f } of FORMATIONS) {
      if (byPos.DEF.length < d || byPos.MID.length < m || byPos.FWD.length < f) continue; // can't field it
      const def = byPos.DEF.slice(0, d), mid = byPos.MID.slice(0, m), fwd = byPos.FWD.slice(0, f);
      const total = (gk?.score ?? 0) + [...def, ...mid, ...fwd].reduce((s, p) => s + p.score, 0);
      if (!best || total > best.total) best = { d, m, f, def, mid, fwd, total };
    }
    // fallback before enough players exist for any full shape: clamp toward a 4-3-3
    if (!best) {
      const d = Math.min(4, byPos.DEF.length), m = Math.min(3, byPos.MID.length), f = Math.min(3, byPos.FWD.length);
      best = { d, m, f, def: byPos.DEF.slice(0, d), mid: byPos.MID.slice(0, m), fwd: byPos.FWD.slice(0, f), total: 0 };
    }
    const label = `${best.d}-${best.m}-${best.f}`;
    // order each line left→right by typical lateral position (no grid history → middle).
    const latOf = (p: XIPlayer) => { const e = lat.get(p.playerId); return e ? e.sum / e.n : 0.5; };
    const order = (r: XIPlayer[]) => r.slice().sort((a, b) => latOf(a) - latOf(b));
    const rows = [gk ? [gk] : [], order(best.def), order(best.mid), order(best.fwd)].filter((r) => r.length > 0);
    return { rows, label };
  }, [matches, playerById]);

  const count = rows.reduce((n, l) => n + l.length, 0);
  if (count === 0) {
    return <p className="card p-6 text-center text-sm text-pitch-400">The Team of the Tournament appears once match ratings start coming in.</p>;
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-sm text-pitch-400">
        Best match ratings (weighted by minutes played), in the legitimate formation that maximises the
        team's average — here <span className="font-semibold text-pitch-200">{label}</span>. Tap a player for their card.
      </p>
      <div
        className="relative mx-auto w-full max-w-[22rem] overflow-hidden rounded-2xl shadow-[inset_0_0_40px_rgba(0,0,0,0.45)] ring-1 ring-white/10"
        style={{ aspectRatio: "68 / 105" }}
      >
        <PitchMarkings />
        {/* orientation: keeper defends the bottom, the XI attacks upward */}
        <div className="absolute top-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-pitch-950/55 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/70 backdrop-blur-sm">
          <ArrowUp size={9} strokeWidth={3} /> Attacking
        </div>
        <div className="absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-pitch-950/55 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-white/70 backdrop-blur-sm">
          Our goal
        </div>
        {rows.flatMap((line, li) =>
          line.map((p, i) => {
            const y = 86 - (li / (rows.length - 1)) * 72; // GK (li=0) near the bottom, striker near the top
            const x = 10 + ((i + 0.5) / line.length) * 80;
            return <XIToken key={p.playerId} p={p} x={x} y={y} onOpen={() => open(p.playerId)} />;
          }),
        )}
      </div>
    </div>
  );
}
