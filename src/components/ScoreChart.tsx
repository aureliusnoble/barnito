import { useMemo } from "react";
import { X } from "lucide-react";
import { useBarnito } from "../data/store";

const COLORS = ["#10b981", "#f97316", "#38bdf8", "#a78bfa", "#f43f5e", "#facc15", "#34d399", "#fb7185", "#818cf8", "#fbbf24"];

export default function ScoreChart({ onClose }: { onClose: () => void }) {
  const { progression, participantById } = useBarnito();

  const { series, maxY, n, xticks } = useMemo(() => {
    const ids = Object.keys(progression.totals);
    const N = progression.steps.length;
    // stable colour per participant (independent of current rank)
    const colorOf = new Map(ids.slice().sort().map((id, i) => [id, COLORS[i % COLORS.length]]));
    let max = 1;
    const series = ids
      .map((id) => {
        const totals = progression.totals[id] ?? [];
        const pts = [{ x: 0, y: 0 }, ...totals.map((t, i) => ({ x: i + 1, y: t }))];
        for (const p of pts) max = Math.max(max, p.y);
        return { id, color: colorOf.get(id)!, pts, total: totals[totals.length - 1] ?? 0 };
      })
      .sort((a, b) => b.total - a.total);
    const niceMax = Math.max(10, Math.ceil(max / 25) * 25);
    const step = Math.max(1, Math.round(N / 6));
    const ticks: number[] = [];
    for (let i = 0; i <= N; i += step) ticks.push(i);
    if (ticks[ticks.length - 1] !== N) ticks.push(N);
    return { series, maxY: niceMax, n: N, xticks: ticks };
  }, [progression]);

  const W = 360, H = 236, padL = 30, padR = 14, padT = 12, padB = 28;
  const x = (v: number) => padL + (n > 0 ? v / n : 0) * (W - padL - padR);
  const y = (v: number) => H - padB - (v / maxY) * (H - padT - padB);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in sm:items-center" onClick={onClose}>
      <div className="card max-h-[88vh] w-full max-w-lg animate-slide-up overflow-y-auto rounded-b-none rounded-t-4xl border-white/10 p-4 sm:rounded-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-display text-lg font-bold text-white">Points by match</h3>
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-pitch-300 hover:bg-white/10 hover:text-white"><X size={16} /></button>
        </div>

        {n === 0 ? (
          <p className="py-8 text-center text-sm text-pitch-400">The graph fills in as matches finish — check back after a few results.</p>
        ) : (
          <>
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
              {/* y gridlines + labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                const yy = y(maxY * f);
                return (
                  <g key={f}>
                    <line x1={padL} x2={W - padR} y1={yy} y2={yy} stroke="#ffffff" strokeOpacity="0.07" strokeWidth="1" />
                    <text x={padL - 5} y={yy + 3} textAnchor="end" style={{ fill: "#5a6a63" }} fontSize="8">{Math.round(maxY * f)}</text>
                  </g>
                );
              })}
              {/* x ticks + labels */}
              {xticks.map((t) => (
                <text key={t} x={x(t)} y={H - padB + 12} textAnchor="middle" style={{ fill: "#5a6a63" }} fontSize="8">{t}</text>
              ))}
              <text x={(padL + W - padR) / 2} y={H - 2} textAnchor="middle" style={{ fill: "#7c8e86" }} fontSize="8.5">matches played</text>
              {/* lines (leader emphasised, drawn last) */}
              {series.slice().reverse().map((s, ri) => {
                const isLeader = ri === series.length - 1;
                return (
                  <polyline
                    key={s.id}
                    fill="none"
                    stroke={s.color}
                    strokeOpacity={isLeader ? 1 : 0.85}
                    strokeWidth={isLeader ? 2.6 : 1.8}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    points={s.pts.map((p) => `${x(p.x).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ")}
                  />
                );
              })}
              {series.map((s) => {
                const last = s.pts[s.pts.length - 1];
                return <circle key={s.id} cx={x(last.x)} cy={y(last.y)} r="2.6" fill={s.color} stroke="#0b1f15" strokeWidth="1" />;
              })}
            </svg>
            <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
              {series.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className="min-w-0 flex-1 truncate text-pitch-200">{participantById.get(s.id)?.name ?? s.id}</span>
                  <span className="font-bold tabular-nums text-white">{s.total}</span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-center text-[11px] text-pitch-500">Cumulative points after each completed match.</p>
          </>
        )}
      </div>
    </div>
  );
}
