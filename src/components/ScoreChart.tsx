import { useMemo } from "react";
import { X } from "lucide-react";
import { useBarnito } from "../data/store";

const COLORS = ["#10b981", "#f97316", "#38bdf8", "#a78bfa", "#f43f5e", "#facc15", "#34d399", "#fb7185", "#818cf8", "#fbbf24"];

export default function ScoreChart({ onClose }: { onClose: () => void }) {
  const { scoreHistory, scores, participantById } = useBarnito();

  const { series, domainMin, domainMax, maxTotal } = useMemo(() => {
    const now = Date.now();
    const byP = new Map<string, { at: number; total: number }[]>();
    for (const h of scoreHistory) {
      const arr = byP.get(h.participantId) ?? byP.set(h.participantId, []).get(h.participantId)!;
      arr.push({ at: Date.parse(h.at), total: h.total });
    }
    // make sure every current participant has a line ending at their live total
    for (const e of scores.leaderboard) {
      const arr = byP.get(e.participantId) ?? byP.set(e.participantId, []).get(e.participantId)!;
      arr.push({ at: now, total: e.total });
    }
    const allAt = [...byP.values()].flat().map((p) => p.at);
    const domainMin = allAt.length ? Math.min(...allAt) : now - 86400_000;
    const domainMax = now;
    let maxTotal = 1;
    const series = [...byP.entries()].map(([id, pts], i) => {
      pts.sort((a, b) => a.at - b.at);
      const points = [{ at: domainMin, total: 0 }, ...pts];
      for (const p of points) maxTotal = Math.max(maxTotal, p.total);
      return { id, color: COLORS[i % COLORS.length], points, total: pts[pts.length - 1]?.total ?? 0 };
    });
    series.sort((a, b) => b.total - a.total);
    return { series, domainMin, domainMax, maxTotal };
  }, [scoreHistory, scores]);

  const W = 320, H = 180, pad = 8, padL = 22, padB = 4;
  const x = (at: number) => padL + (domainMax > domainMin ? (at - domainMin) / (domainMax - domainMin) : 0) * (W - padL - pad);
  const y = (t: number) => H - padB - pad - (t / maxTotal) * (H - 2 * pad - padB);

  const enough = scoreHistory.length >= 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in sm:items-center" onClick={onClose}>
      <div className="card max-h-[88vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-b-none rounded-t-4xl border-white/10 p-4 sm:rounded-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-white">Points over the tournament</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-pitch-300 hover:bg-white/10 hover:text-white"><X size={16} /></button>
        </div>

        {!enough ? (
          <p className="py-8 text-center text-sm text-pitch-400">The graph fills in as matches finish — check back after a few results.</p>
        ) : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
              {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                <g key={f}>
                  <line x1={padL} x2={W - pad} y1={y(maxTotal * f)} y2={y(maxTotal * f)} stroke="#1a2320" strokeWidth="1" />
                  <text x={padL - 4} y={y(maxTotal * f) + 3} textAnchor="end" style={{ fill: "#5a6a63" }} fontSize="7">{Math.round(maxTotal * f)}</text>
                </g>
              ))}
              {series.map((s) => (
                <polyline key={s.id} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
                  points={s.points.map((p) => `${x(p.at).toFixed(1)},${y(p.total).toFixed(1)}`).join(" ")} />
              ))}
              {series.map((s) => {
                const last = s.points[s.points.length - 1];
                return <circle key={s.id} cx={x(last.at)} cy={y(last.total)} r="2.5" fill={s.color} />;
              })}
            </svg>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {series.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1 truncate text-pitch-200">{participantById.get(s.id)?.name ?? s.id}</span>
                  <span className="font-bold tabular-nums text-white">{s.total}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
