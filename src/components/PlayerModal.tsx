import { createContext, useContext, useState, type ReactNode } from "react";
import { X, Goal, CalendarClock } from "lucide-react";
import { useBarnito, useHelpers } from "../data/store";
import { Avatar } from "./visuals";
import { Crest, CardFlag } from "./bits";
import { POSITION_LABEL, formatDay, formatTime } from "../lib/format";
import { GOAL_MULTIPLIER } from "@shared/constants";
import type { Position } from "@shared/types";

/**
 * What we know about a player when opening the modal. A roster `playerId` is enough; the rest is a
 * fallback so entries that didn't match a roster player (e.g. some Golden Boot scorers) still open
 * with name/team/goals from the stat line instead of being un-clickable.
 */
export interface PlayerSeed {
  playerId?: string | null;
  name?: string;
  photo?: string | null;
  teamId?: string | null;
  teamName?: string | null;
  position?: Position | null;
  goals?: number;
  apps?: number;
}

interface Ctx { open: (arg: string | PlayerSeed) => void }
const C = createContext<Ctx>({ open: () => {} });
export const usePlayerModal = () => useContext(C);

export function PlayerModalProvider({ children }: { children: ReactNode }) {
  const [seed, setSeed] = useState<PlayerSeed | null>(null);
  return (
    <C.Provider value={{ open: (arg) => setSeed(typeof arg === "string" ? { playerId: arg } : arg) }}>
      {children}
      {seed && <PlayerDetail seed={seed} onClose={() => setSeed(null)} />}
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

function PlayerDetail({ seed, onClose }: { seed: PlayerSeed; onClose: () => void }) {
  const { playerById, playerStats, matches } = useBarnito();
  const { teamName } = useHelpers();
  const p = seed.playerId ? playerById.get(seed.playerId) : undefined;

  // Prefer the matched roster player; fall back to whatever the caller knew (the stat line).
  const name = p?.name ?? seed.name ?? seed.playerId ?? "Player";
  const photo = p?.photo ?? seed.photo ?? null;
  const teamId = p?.teamId ?? seed.teamId ?? null;
  const team = teamId ? teamName(teamId) : seed.teamName ?? null;
  const position: Position | null = p?.position ?? seed.position ?? null;
  const multiplier = p?.goalMultiplier ?? (position ? GOAL_MULTIPLIER[position] : null);
  const club = p?.club ?? null;

  // Per-player stats only exist for matched roster ids; otherwise use the seed's headline numbers.
  const rosterStats = seed.playerId ? playerStats.players[seed.playerId] : undefined;
  const s = rosterStats ?? { goals: seed.goals ?? 0, yellow: 0, red: 0, apps: seed.apps ?? 0 };
  const points = multiplier ? s.goals * multiplier : 0;

  // The team's next scheduled fixture.
  const cutoff = Date.now() - 3 * 3600_000;
  const next = teamId
    ? matches.matches
        .filter((m) => (m.homeTeamId === teamId || m.awayTeamId === teamId) && m.status === "SCHEDULED" && Date.parse(m.kickoff) > cutoff)
        .sort((a, b) => a.kickoff.localeCompare(b.kickoff))[0]
    : undefined;
  const opponentId = next ? (next.homeTeamId === teamId ? next.awayTeamId : next.homeTeamId) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in sm:items-center" onClick={onClose}>
      <div className="card max-h-[88vh] w-full max-w-sm animate-slide-up overflow-y-auto rounded-b-none rounded-t-4xl border-white/10 p-5 sm:rounded-4xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex justify-end">
          <button onClick={onClose} className="grid h-7 w-7 place-items-center rounded-full bg-white/5 text-pitch-300 hover:bg-white/10 hover:text-white"><X size={16} /></button>
        </div>
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar photo={photo} name={name} position={position} size={72} />
          <div className="font-display text-xl font-bold text-white">{name}</div>
          {(teamId || team) && (
            <div className="flex items-center gap-1.5 text-sm text-pitch-300">
              {teamId && <Crest teamId={teamId} size={16} />} {team}{position ? ` · ${POSITION_LABEL[position]}` : ""}
            </div>
          )}
          {club?.name && (
            <div className="mt-0.5 flex items-center gap-2 rounded-full bg-white/5 px-2.5 py-1" title="Club side">
              {club.logo && <img src={club.logo} alt="" width={22} height={22} className="inline-block object-contain" />}
              <span className="text-left leading-tight">
                <span className="block text-sm font-semibold text-pitch-100">{club.name}</span>
                {club.league && <span className="block text-[10px] text-pitch-400">{club.league}</span>}
              </span>
            </div>
          )}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Goals" value={s.goals} accent="text-accent-300" />
          <Stat label="Apps" value={s.apps} />
          <Stat label="Points" value={points} accent="text-accent-300" />
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div className="card flex flex-col items-center justify-center gap-1 p-3">
            {s.red > 0 || s.yellow > 0 ? (
              <>
                <CardFlag yellow={s.yellow > 0} red={s.red > 0} size={20} />
                <span className="text-[10px] uppercase tracking-wide text-pitch-400">{s.red > 0 ? "Red card" : "Booked"}</span>
              </>
            ) : (
              <>
                <span className="font-display text-sm font-bold text-pitch-300">Clean</span>
                <span className="text-[10px] uppercase tracking-wide text-pitch-400">No cards</span>
              </>
            )}
          </div>
          <div className="card flex flex-col items-center justify-center gap-1 p-3">
            <Goal size={18} className="text-pitch-400" />
            <span className="text-[10px] uppercase tracking-wide text-pitch-400">{multiplier ? `×${multiplier} / goal` : ""}</span>
          </div>
        </div>
        {next && opponentId && (
          <div className="mt-2 flex items-center justify-center gap-1.5 rounded-xl bg-white/[0.04] px-3 py-2 text-xs text-pitch-300">
            <CalendarClock size={13} className="text-pitch-400" />
            <span className="text-pitch-400">Next</span>
            <Crest teamId={opponentId} size={15} />
            <span className="font-semibold text-pitch-100">{teamName(opponentId)}</span>
            <span className="text-pitch-500">· {formatDay(next.kickoff)} {formatTime(next.kickoff)}</span>
          </div>
        )}
        <p className="mt-3 text-center text-[11px] text-pitch-500">Goal points = goals × {multiplier ?? "?"}{position ? ` (${POSITION_LABEL[position]})` : ""}.</p>
      </div>
    </div>
  );
}
