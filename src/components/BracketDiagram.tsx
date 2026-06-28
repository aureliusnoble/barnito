import { useMemo } from "react";
import { useBarnito, useHelpers } from "../data/store";
import { Crest } from "./bits";
import { useMatchModal } from "./MatchModal";
import { formatDay, formatTime } from "../lib/format";
import type { BracketMatch } from "@shared/types";

// Full knockout bracket as a connected left-to-right tree (R32 → Final), in the official WC-2026 order
// (not kickoff order). Blank slots show ties not yet confirmed; tap a confirmed tie for the full card.
const CANON: [string, number][] = [
  ["Round of 32", 16], ["Round of 16", 8], ["Quarter-finals", 4], ["Semi-finals", 2], ["Final", 1],
];
const SHORT: Record<string, string> = { "Round of 32": "R32", "Round of 16": "R16", "Quarter-finals": "QF", "Semi-finals": "SF", "Final": "Final" };
// Official WC-2026 bracket, top→bottom LEAF order so consecutive pairs reproduce the real R16 ties
// (89←m74/m77, 90←m73/m75, …). Each slot lists one deterministic group placement (winner/runner-up) —
// enough to locate the tie; its best-third side rides along, and a team keeps its origin slot through
// later rounds. Sequence: matches 74,77,73,75,76,78,79,80 (top half) then 83,84,81,82,86,88,85,87.
const R32_SLOTS = ["1E", "1I", "2A", "1F", "1C", "2E", "1A", "1L", "2K", "1H", "1D", "1G", "1J", "2D", "1B", "1K"];

const BOX_W = 108, BOX_H = 48, GAP = 30, COL_W = BOX_W + GAP, VX = BOX_W + GAP / 2, H = 16 * 56;
const LINE = "#3f5546";

function Row({ teamId, name, goals, won }: { teamId: string | null; name?: string | null; goals: number | null; won: boolean }) {
  const { teamName } = useHelpers();
  return (
    <div className={`flex min-h-0 flex-1 items-center gap-1 px-1 ${won ? "text-white" : "text-pitch-300"}`}>
      {teamId ? <Crest teamId={teamId} size={13} /> : <span className="grid h-[13px] w-[13px] shrink-0 place-items-center rounded-full border border-dashed border-pitch-600 text-[7px] text-pitch-600">?</span>}
      <span className={`min-w-0 flex-1 truncate text-[10px] ${won ? "font-bold" : ""} ${!teamId ? "italic text-pitch-600" : ""}`}>
        {teamId ? teamName(teamId) : name ?? "TBC"}
      </span>
      {goals != null && <span className="font-display text-[10px] tabular-nums">{goals}</span>}
    </div>
  );
}

function MatchBox({ m, onOpen }: { m: BracketMatch | null; onOpen?: () => void }) {
  const score = !!m && m.homeGoals != null && m.awayGoals != null;
  const live = m?.status === "LIVE" || m?.status === "HT";
  const Tag = onOpen ? "button" : "div";
  return (
    <Tag
      onClick={onOpen}
      className={`flex h-full w-full flex-col overflow-hidden rounded-md bg-pitch-900 text-left ring-1 ${live ? "ring-red-500/50" : "ring-white/10"} ${onOpen ? "cursor-pointer transition hover:ring-accent-500/50" : ""}`}
    >
      <div className="flex items-center justify-between px-1 pt-px text-[7.5px] leading-tight text-pitch-500">
        <span className="truncate">{m?.kickoff ? `${formatDay(m.kickoff)} · ${formatTime(m.kickoff)}` : "TBC"}</span>
        {m?.status === "FINISHED" && <span className="shrink-0 text-pitch-400">FT</span>}
        {live && <span className="shrink-0 font-semibold text-red-400">LIVE</span>}
      </div>
      <div className="flex flex-1 flex-col">
        <Row teamId={m?.homeTeamId ?? null} name={m?.homeName} goals={m?.homeGoals ?? null} won={!!score && m!.homeGoals! > m!.awayGoals!} />
        <div className="border-t border-white/[0.06]" />
        <Row teamId={m?.awayTeamId ?? null} name={m?.awayName} goals={m?.awayGoals ?? null} won={!!score && m!.awayGoals! > m!.homeGoals!} />
      </div>
    </Tag>
  );
}

export default function BracketDiagram() {
  const { bracket, standings, matches } = useBarnito();
  const { open } = useMatchModal();

  // Final group placements → team ("1A" = group A winner, "2A" = runner-up).
  const placement = useMemo(() => {
    const m = new Map<string, string>();
    for (const g of standings.groups) {
      if (g.rows[0]) m.set(`1${g.group}`, g.rows[0].teamId);
      if (g.rows[1]) m.set(`2${g.group}`, g.rows[1].teamId);
    }
    return m;
  }, [standings]);

  const r32Ties = useMemo(() => bracket.rounds.find((r) => r.name === "Round of 32")?.matches ?? [], [bracket]);

  // Place each R32 tie into its official slot via the deterministic side; record each team's origin slot.
  const { teamOrigin, r32BySlot } = useMemo(() => {
    const origin = new Map<string, number>();
    const bySlot: (BracketMatch | null)[] = Array(16).fill(null);
    for (const tie of r32Ties) {
      let slot = -1;
      for (let i = 0; i < 16; i++) {
        const t = placement.get(R32_SLOTS[i]);
        if (t && (t === tie.homeTeamId || t === tie.awayTeamId)) { slot = i; break; }
      }
      if (slot < 0) continue;
      bySlot[slot] = tie;
      if (tie.homeTeamId) origin.set(tie.homeTeamId, slot);
      if (tie.awayTeamId) origin.set(tie.awayTeamId, slot);
    }
    return { teamOrigin: origin, r32BySlot: bySlot };
  }, [r32Ties, placement]);

  const matchIdByApi = useMemo(() => {
    const m = new Map<number, string>();
    for (const x of matches.matches) if (x.apiId != null) m.set(x.apiId, x.id);
    return m;
  }, [matches]);

  // Build each round's slots: R32 from the official order; later rounds by each team's origin slot.
  const cols = CANON.map(([name, n], r) => {
    const slots: (BracketMatch | null)[] = Array(n).fill(null);
    if (name === "Round of 32") {
      for (let i = 0; i < 16; i++) slots[i] = r32BySlot[i];
    } else {
      for (const tie of bracket.rounds.find((x) => x.name === name)?.matches ?? []) {
        const t = tie.homeTeamId ?? tie.awayTeamId ?? null;
        const o = t != null ? teamOrigin.get(t) : undefined;
        if (o == null) continue;
        const slot = Math.floor(o / 2 ** r);
        if (slot >= 0 && slot < n && !slots[slot]) slots[slot] = tie;
      }
    }
    return { name, n, slots };
  });
  const totalW = COL_W * cols.length;

  return (
    <div className="-mx-3 overflow-x-auto px-3 pb-2">
      <div style={{ width: totalW }}>
        <div className="mb-1 flex">
          {cols.map((c) => (
            <div key={c.name} style={{ width: COL_W }} className="text-center text-[10px] font-semibold uppercase tracking-wide text-pitch-500">{SHORT[c.name]}</div>
          ))}
        </div>
        <div className="relative flex" style={{ height: H }}>
          {cols.map((c, r) => {
            const slot = H / c.n;
            return (
              <div key={c.name} className="relative shrink-0" style={{ width: COL_W, height: H }}>
                {c.slots.map((m, i) => {
                  const yc = (i + 0.5) * slot;
                  const canOpen = !!(m && m.homeTeamId && m.awayTeamId && m.apiId != null && matchIdByApi.has(m.apiId));
                  const onOpen = canOpen ? () => open(matchIdByApi.get(m!.apiId!)!) : undefined;
                  const nodes = [
                    <div key={`b${i}`} style={{ position: "absolute", top: yc - BOX_H / 2, left: 0, width: BOX_W, height: BOX_H }}>
                      <MatchBox m={m} onOpen={onOpen} />
                    </div>,
                  ];
                  if (r < cols.length - 1 && i % 2 === 0) {
                    const y0 = yc, y1 = (i + 1.5) * slot, mid = (y0 + y1) / 2;
                    nodes.push(
                      <div key={`c${i}`}>
                        <span style={{ position: "absolute", left: BOX_W, top: y0, width: VX - BOX_W, borderTop: `1px solid ${LINE}` }} />
                        <span style={{ position: "absolute", left: BOX_W, top: y1, width: VX - BOX_W, borderTop: `1px solid ${LINE}` }} />
                        <span style={{ position: "absolute", left: VX, top: y0, height: y1 - y0, borderLeft: `1px solid ${LINE}` }} />
                        <span style={{ position: "absolute", left: VX, top: mid, width: COL_W - VX, borderTop: `1px solid ${LINE}` }} />
                      </div>,
                    );
                  }
                  return nodes;
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
