import { createContext, useContext, useState, type ReactNode } from "react";
import { X, Goal } from "lucide-react";
import { useBarnito, useHelpers } from "../data/store";
import { Avatar } from "./visuals";
import { Crest } from "./bits";
import { POSITION_LABEL } from "../lib/format";

interface Ctx { open: (playerId: string) => void }
const C = createContext<Ctx>({ open: () => {} });
export const usePlayerModal = () => useContext(C);

export function PlayerModalProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string | null>(null);
  return (
    <C.Provider value={{ open: setId }}>
      {children}
      {id && <PlayerDetail playerId={id} onClose={() => setId(null)} />}
    </C.Provider>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: string }) {
  return (
    <div className="card flex flex-col items-center gap-0.5 p-3">
      <span className={`font-display text-2xl font-extrabold ${accent ?? "text-white"}`}>{value}</span>
      <span className="text-[10px] uppercase tracking-wide text-pitch-400">{label}</span>
    </div>
  );
}

function PlayerDetail({ playerId, onClose }: { playerId: string; onClose: () => void }) {
  const { playerById, playerStats } = useBarnito();
  const { teamName } = useHelpers();
  const p = playerById.get(playerId);
  const s = playerStats.players[playerId] ?? { goals: 0, yellow: 0, red: 0, apps: 0 };
  const points = p ? s.goals * p.goalMultiplier : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in sm:items-center" onClick={onClose}>
      <div className="card max-h-[88vh] w-full max-w-sm animate-slide-up overflow-y-auto rounded-b-none rounded-t-4xl border-white/10 p-5 sm:rounded-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex justify-end">
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-pitch-300 hover:bg-white/10 hover:text-white"><X size={16} /></button>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar photo={p?.photo} name={p?.name ?? playerId} position={p?.position ?? null} size={72} />
          <div className="font-display text-xl font-bold text-white">{p?.name ?? playerId}</div>
          {p && (
            <div className="flex items-center gap-1.5 text-sm text-pitch-300">
              <Crest teamId={p.teamId} size={16} /> {teamName(p.teamId)} · {POSITION_LABEL[p.position]}
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Goals" value={s.goals} accent="text-accent-300" />
          <Stat label="Apps" value={s.apps} />
          <Stat label="Points" value={points} accent="text-accent-300" />
          <Stat label="Yellow" value={s.yellow} accent="text-yellow-400" />
          <Stat label="Red" value={s.red} accent="text-red-400" />
          <div className="card flex flex-col items-center justify-center gap-0.5 p-3">
            <Goal size={18} className="text-pitch-400" />
            <span className="text-[10px] uppercase tracking-wide text-pitch-400">{p ? `×${p.goalMultiplier}/goal` : ""}</span>
          </div>
        </div>
        <p className="mt-3 text-center text-[11px] text-pitch-500">Goal points = goals × {p?.goalMultiplier ?? "?"} ({p ? POSITION_LABEL[p.position] : ""}).</p>
      </div>
    </div>
  );
}
