import { useMemo, useState } from "react";
import { Goal, Trophy, Users, AlertTriangle, ChevronDown, ChevronRight, Star, Search } from "lucide-react";
import { useBarnito, useHelpers } from "../data/store";
import { usePlayerModal, type PlayerSeed } from "../components/PlayerModal";
import { SectionTitle, Crest, CardFlag, PosBadge } from "../components/bits";
import { Avatar } from "../components/visuals";
import BestXI from "../components/BestXI";
import type { Position, PlayerStatLine } from "@shared/types";

/** Build a player-modal seed from a Golden Boot stat line so even unmatched scorers open. */
const seedFromStat = (p: PlayerStatLine): PlayerSeed => ({
  playerId: p.playerId,
  name: p.name,
  photo: p.photo,
  teamId: p.teamId,
  teamName: p.teamName,
  position: p.position ?? null,
  goals: p.value,
  apps: p.appearances,
});

type View = "people" | "boot" | "players" | "bestxi" | "find";
const normName = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default function Scorers() {
  const [view, setView] = useState<View>("people");
  return (
    <div className="space-y-4">
      <SectionTitle icon={<Goal size={18} className="text-accent-400" />} hint="32 DEF/GK · 16 MID · 8 FWD per goal">
        Goal scorers
      </SectionTitle>
      <div className="flex flex-wrap gap-1.5">
        <Toggle on={view === "people"} onClick={() => setView("people")} icon={<Users size={14} />}>
          Picks
        </Toggle>
        <Toggle on={view === "boot"} onClick={() => setView("boot")} icon={<Trophy size={14} />}>
          Golden Boot
        </Toggle>
        <Toggle on={view === "players"} onClick={() => setView("players")} icon={<Goal size={14} />}>
          Most-picked
        </Toggle>
        <Toggle on={view === "bestxi"} onClick={() => setView("bestxi")} icon={<Star size={14} />}>
          Best XI
        </Toggle>
        <Toggle on={view === "find"} onClick={() => setView("find")} icon={<Search size={14} />}>
          Find
        </Toggle>
      </div>
      {view === "people" ? <ByPerson /> : view === "boot" ? <GoldenBoot /> : view === "players" ? <ByPlayer /> : view === "bestxi" ? <BestXI /> : <FindScorers />}
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

function ByPerson() {
  const { scores, participantById, playerById, injuryByPlayerId, playerStats } = useBarnito();
  const { open } = usePlayerModal();
  const { teamName } = useHelpers();
  const [openId, setOpenId] = useState<string | null>(null);
  const ordered = useMemo(() => [...scores.scorerView].sort((a, b) => b.total - a.total), [scores]);

  if (ordered.length === 0) {
    return (
      <p className="card p-6 text-center text-sm text-pitch-400">
        Everyone's six scorers appear here once predictions are uploaded.
      </p>
    );
  }

  const leader = ordered[0];
  const totalGoals = ordered.reduce((n, sv) => n + sv.picks.reduce((g, p) => g + p.goals, 0), 0);

  return (
    <div className="space-y-3">
      {/* headline */}
      <div className="grid grid-cols-2 gap-3">
        <div className="card flex flex-col gap-0.5 p-3">
          <span className="text-[11px] uppercase tracking-wide text-pitch-400">Leading hauler</span>
          <span className="truncate font-display font-bold text-white">{leader.name}</span>
          <span className="text-xs text-accent-300">{leader.total} pts from scorers</span>
        </div>
        <div className="card flex flex-col gap-0.5 p-3">
          <span className="text-[11px] uppercase tracking-wide text-pitch-400">Goals from all picks</span>
          <span className="font-display text-2xl font-extrabold text-white">{totalGoals}</span>
          <span className="text-xs text-pitch-500">across {ordered.length} {ordered.length === 1 ? "player" : "players"}</span>
        </div>
      </div>

      {/* ranked — tap to dive into a player's six scorers */}
      <div className="space-y-2">
        {ordered.map((sv, i) => {
          const champ = participantById.get(sv.participantId)?.champion;
          const goals = sv.picks.reduce((n, p) => n + p.goals, 0);
          const isOpen = openId === sv.participantId;
          return (
            <div key={sv.participantId} className="card overflow-hidden">
              <button
                onClick={() => setOpenId(isOpen ? null : sv.participantId)}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
              >
                <span className="w-5 shrink-0 text-center font-display font-bold text-pitch-500">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-display font-bold text-white">{sv.name}</span>
                    {champ && <span title="Champion pick"><Crest teamId={champ} size={14} /></span>}
                  </span>
                  <span className="text-[11px] text-pitch-400">
                    {goals} {goals === 1 ? "goal" : "goals"} · {sv.picks.length} picks
                  </span>
                </div>
                <span className="font-display text-lg font-extrabold tabular-nums text-white">{sv.total}</span>
                <ChevronDown size={16} className={`shrink-0 text-pitch-500 transition ${isOpen ? "rotate-180" : ""}`} />
              </button>
              {isOpen && (
                <ul className="divide-y divide-white/[0.04] border-t border-white/[0.06]">
                  {sv.picks.map((p) => {
                    const player = playerById.get(p.playerId);
                    const injury = injuryByPlayerId.get(p.playerId);
                    const cs = playerStats.players[p.playerId];
                    return (
                      <li key={p.playerId} onClick={() => open(p.playerId)} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-white/[0.03]">
                        <Avatar photo={player?.photo} name={p.playerName} position={p.position} size={30} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-pitch-100">{p.playerName}</span>
                            {cs && <CardFlag yellow={cs.yellow > 0} red={cs.red > 0} size={12} />}
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
                        <PosBadge position={p.position} />
                        <span className="w-9 text-right text-pitch-300">
                          {p.goals}
                          <span className="text-[10px] text-pitch-500"> gl</span>
                        </span>
                        <span className="w-10 text-right font-bold tabular-nums text-white">{p.points}</span>
                        <ChevronRight size={14} className="shrink-0 text-pitch-600" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function GoldenBoot() {
  const { stats, scores, playerStats, playerById } = useBarnito();
  const { open } = usePlayerModal();
  const { teamName } = useHelpers();
  const pickedIds = useMemo(() => {
    const s = new Set<string>();
    for (const sv of scores.scorerView) for (const p of sv.picks) s.add(p.playerId);
    return s;
  }, [scores]);

  // Drive the boot from our own goal events (real-time) so a just-scored goal shows immediately,
  // then merge API-Football's topscorers (which lags post-match) for any extra coverage.
  const scorers = useMemo<PlayerStatLine[]>(() => {
    const map = new Map<string, PlayerStatLine>();
    for (const [pid, s] of Object.entries(playerStats.players)) {
      if (!s.goals) continue;
      const pl = playerById.get(pid);
      map.set(pid, {
        playerId: pid, apiId: pl?.apiId ?? null, name: pl?.name ?? pid,
        teamId: pl?.teamId ?? null, teamName: pl ? teamName(pl.teamId) : "",
        photo: pl?.photo ?? null, position: pl?.position ?? null,
        value: s.goals, goals: s.goals, assists: s.assists ?? 0,
      });
    }
    for (const e of stats.topScorers) {
      const existing = e.playerId ? map.get(e.playerId) : undefined;
      if (existing) {
        existing.value = Math.max(existing.value, e.value);
        existing.goals = Math.max(existing.goals ?? 0, e.goals ?? e.value);
        existing.photo ??= e.photo ?? null;
      } else {
        map.set(e.playerId ?? `api:${e.apiId}`, e);
      }
    }
    return [...map.values()].filter((p) => p.value > 0).sort((a, b) => b.value - a.value || (b.goals ?? 0) - (a.goals ?? 0));
  }, [playerStats, playerById, stats, teamName]);

  if (scorers.length === 0) {
    return (
      <p className="card p-6 text-center text-sm text-pitch-400">
        The tournament top-scorer race appears once live data is flowing.
      </p>
    );
  }
  const podium = scorers.slice(0, 3);
  const rest = scorers.slice(3);
  const medal = ["text-yellow-400", "text-pitch-300", "text-spice-400"];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {podium.map((p, i) => (
          <div key={p.apiId ?? p.name} onClick={() => open(seedFromStat(p))} className="card flex cursor-pointer flex-col items-center gap-1.5 p-3 text-center card-hover">
            <Trophy size={16} className={medal[i]} />
            <Avatar photo={p.photo} name={p.name} position={p.position ?? null} size={44} />
            <span className="flex max-w-full items-center gap-1">
              <span className="truncate text-xs font-semibold text-white" title={p.name}>{p.name}</span>
              <PosBadge position={p.position} />
            </span>
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
          <li key={p.apiId ?? p.name} onClick={() => open(seedFromStat(p))} className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-white/[0.03]">
            <span className="w-5 text-center font-mono text-xs text-pitch-500">{i + 4}</span>
            <Avatar photo={p.photo} name={p.name} position={p.position ?? null} size={26} />
            <span className="min-w-0 flex-1 truncate text-pitch-100">{p.name}</span>
            <PosBadge position={p.position} />
            {p.teamId && <Crest teamId={p.teamId} size={14} />}
            {p.playerId && pickedIds.has(p.playerId) && <span title="Picked">🎯</span>}
            <span className="w-8 text-right font-bold tabular-nums text-white">{p.value}</span>
            <ChevronRight size={14} className="shrink-0 text-pitch-600" />
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
  const { open } = usePlayerModal();
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
          <div key={a.playerId} onClick={() => open(a.playerId)} className="card card-hover flex cursor-pointer items-center gap-2.5 p-3 text-sm">
            <Avatar photo={player?.photo} name={a.playerName} position={a.position} size={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-semibold text-white">{a.playerName}</span>
                <PosBadge position={a.position} />
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
            <ChevronRight size={14} className="shrink-0 text-pitch-600" />
          </div>
        );
      })}
    </div>
  );
}

// Browse players by team / position to help pick top scorers; optionally restrict to teams still in.
function FindScorers() {
  const { roster, bracket, playerStats } = useBarnito();
  const { teamName } = useHelpers();
  const { open } = usePlayerModal();
  const [team, setTeam] = useState("");
  const [pos, setPos] = useState<Position | "">("");
  const [stillIn, setStillIn] = useState(true);
  const [q, setQ] = useState("");

  const stillInSet = useMemo(() => {
    const all = new Set(roster.teams.map((t) => t.id));
    const r32 = bracket.rounds.find((r) => r.name === "Round of 32");
    const qual = new Set<string>();
    if (r32) for (const m of r32.matches) { if (m.homeTeamId) qual.add(m.homeTeamId); if (m.awayTeamId) qual.add(m.awayTeamId); }
    const out = new Set<string>();
    for (const round of bracket.rounds) for (const m of round.matches) {
      if (m.status === "FINISHED" && m.homeGoals != null && m.awayGoals != null && m.homeGoals !== m.awayGoals) {
        out.add(m.homeGoals < m.awayGoals ? (m.homeTeamId ?? "") : (m.awayTeamId ?? ""));
      }
    }
    return new Set([...(qual.size ? qual : all)].filter((t) => !out.has(t)));
  }, [bracket, roster]);

  const teams = useMemo(() => [...roster.teams].sort((a, b) => a.name.localeCompare(b.name)), [roster.teams]);
  const goalsOf = (id: string) => playerStats.players[id]?.goals ?? 0;
  const results = useMemo(() => {
    const qq = normName(q.trim());
    return roster.players
      .filter((p) => p.age != null
        && (!team || p.teamId === team)
        && (!pos || p.position === pos)
        && (!stillIn || stillInSet.has(p.teamId))
        && (qq.length < 2 || normName(p.name).includes(qq)))
      .sort((a, b) => goalsOf(b.id) - goalsOf(a.id) || a.name.localeCompare(b.name))
      .slice(0, 150);
  }, [roster.players, team, pos, stillIn, q, stillInSet, playerStats]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl bg-pitch-900 px-3 py-2 ring-1 ring-white/10 focus-within:ring-accent-500/40">
        <Search size={16} className="shrink-0 text-pitch-500" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search players…" className="w-full bg-transparent text-sm text-pitch-100 placeholder:text-pitch-500 focus:outline-none" />
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <select value={team} onChange={(e) => setTeam(e.target.value)} className="rounded-lg bg-pitch-900 px-2.5 py-1.5 text-sm text-pitch-100 ring-1 ring-white/10 focus:outline-none">
          <option value="">All teams</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        {(["GK", "DEF", "MID", "FWD"] as const).map((p) => (
          <button key={p} onClick={() => setPos(pos === p ? "" : p)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${pos === p ? "bg-accent-500 text-pitch-950" : "bg-pitch-800 text-pitch-300 ring-1 ring-white/10 hover:text-white"}`}>{p}</button>
        ))}
        <button onClick={() => setStillIn((v) => !v)} className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${stillIn ? "bg-emerald-600 text-white" : "bg-pitch-800 text-pitch-300 ring-1 ring-white/10 hover:text-white"}`}>Still in</button>
      </div>
      <div className="px-1 text-[11px] text-pitch-500">{results.length} player{results.length === 1 ? "" : "s"}{results.length === 150 ? "+ — refine to narrow" : ""}</div>
      <ul className="space-y-1">
        {results.map((p) => (
          <li key={p.id}>
            <button onClick={() => open(p.id)} className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left hover:bg-white/[0.04]">
              <Avatar photo={p.photo} name={p.name} position={p.position} size={28} />
              <span className="min-w-0 flex-1 truncate text-sm text-pitch-100">{p.name}</span>
              {goalsOf(p.id) > 0 && <span className="shrink-0 text-xs font-semibold text-accent-300">{goalsOf(p.id)}⚽</span>}
              <PosBadge position={p.position} />
              <span className="flex shrink-0 items-center gap-1 text-xs text-pitch-400"><Crest teamId={p.teamId} size={12} /><span className="hidden max-w-[6rem] truncate sm:inline">{teamName(p.teamId)}</span></span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
