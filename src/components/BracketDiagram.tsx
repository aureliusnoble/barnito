import { useBarnito, useHelpers } from "../data/store";
import { Crest } from "./bits";
import type { BracketMatch } from "@shared/types";

// Full knockout bracket as a connected left-to-right tree (R32 → Final), with blank slots for ties
// not yet confirmed. Distinct from the compact round-by-round list used on the Matches page.
const CANON: [string, number][] = [
  ["Round of 32", 16], ["Round of 16", 8], ["Quarter-finals", 4], ["Semi-finals", 2], ["Final", 1],
];
const SHORT: Record<string, string> = { "Round of 32": "R32", "Round of 16": "R16", "Quarter-finals": "QF", "Semi-finals": "SF", "Final": "Final" };

const BOX_W = 104, BOX_H = 38, GAP = 30, COL_W = BOX_W + GAP, VX = BOX_W + GAP / 2, H = 16 * 45;
const LINE = "#3f5546"; // pitch-600-ish connector colour

function Row({ teamId, name, goals, won }: { teamId: string | null; name?: string | null; goals: number | null; won: boolean }) {
  const { teamName } = useHelpers();
  return (
    <div className={`flex h-1/2 items-center gap-1 px-1 ${won ? "text-white" : "text-pitch-300"}`}>
      {teamId ? <Crest teamId={teamId} size={13} /> : <span className="grid h-[13px] w-[13px] shrink-0 place-items-center rounded-full border border-dashed border-pitch-600 text-[7px] text-pitch-600">?</span>}
      <span className={`min-w-0 flex-1 truncate text-[10px] ${won ? "font-bold" : ""} ${!teamId ? "italic text-pitch-600" : ""}`}>
        {teamId ? teamName(teamId) : name ?? "TBC"}
      </span>
      {goals != null && <span className="font-display text-[10px] tabular-nums">{goals}</span>}
    </div>
  );
}

function MatchBox({ m }: { m: BracketMatch | null }) {
  const score = !!m && m.homeGoals != null && m.awayGoals != null;
  const live = m?.status === "LIVE" || m?.status === "HT";
  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-md bg-pitch-900 ring-1 ${live ? "ring-red-500/50" : "ring-white/10"}`}>
      <Row teamId={m?.homeTeamId ?? null} name={m?.homeName} goals={m?.homeGoals ?? null} won={!!score && m!.homeGoals! > m!.awayGoals!} />
      <div className="border-t border-white/[0.06]" />
      <Row teamId={m?.awayTeamId ?? null} name={m?.awayName} goals={m?.awayGoals ?? null} won={!!score && m!.awayGoals! > m!.homeGoals!} />
    </div>
  );
}

export default function BracketDiagram() {
  const { bracket } = useBarnito();
  const cols = CANON.map(([name, n]) => {
    const ms = bracket.rounds.find((r) => r.name === name)?.matches ?? [];
    return { name, n, slots: Array.from({ length: n }, (_, i) => ms[i] ?? null) };
  });
  const totalW = COL_W * cols.length;

  return (
    <div className="-mx-3 overflow-x-auto px-3 pb-2">
      <div style={{ width: totalW }}>
        {/* round headers */}
        <div className="mb-1 flex">
          {cols.map((c) => (
            <div key={c.name} style={{ width: COL_W }} className="text-center text-[10px] font-semibold uppercase tracking-wide text-pitch-500">{SHORT[c.name]}</div>
          ))}
        </div>
        {/* tree */}
        <div className="relative flex" style={{ height: H }}>
          {cols.map((c, r) => {
            const slot = H / c.n;
            return (
              <div key={c.name} className="relative shrink-0" style={{ width: COL_W, height: H }}>
                {c.slots.map((m, i) => {
                  const yc = (i + 0.5) * slot;
                  const nodes = [
                    <div key={`b${i}`} style={{ position: "absolute", top: yc - BOX_H / 2, left: 0, width: BOX_W, height: BOX_H }}>
                      <MatchBox m={m} />
                    </div>,
                  ];
                  // connector from each adjacent pair into the next round's match
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
