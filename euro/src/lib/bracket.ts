// Knockout bracket wiring — Euro 24-team format (as used at Euro 2024).
// R16 slots come from group finishes (winners, runners-up, four best thirds via
// the UEFA mapping table); later rounds feed from earlier winners.

import type { EFixture, ETeam, EGroup } from "../types";
import { bestThirds, groupComplete, groupTable } from "./table";

type Slot =
  | { kind: "pos"; group: EGroup; pos: 1 | 2 } // e.g. winner of A, runner-up of C
  | { kind: "third"; of: EGroup[] }; // a best-third drawn from these groups

/** R16 template, home/away per fixture id (matches the official Euro 2024 tree). */
export const R16_TEMPLATE: Record<string, { home: Slot; away: Slot }> = {
  "r16-1": { home: { kind: "pos", group: "A", pos: 2 }, away: { kind: "pos", group: "B", pos: 2 } },
  "r16-2": { home: { kind: "pos", group: "A", pos: 1 }, away: { kind: "pos", group: "C", pos: 2 } },
  "r16-3": { home: { kind: "pos", group: "C", pos: 1 }, away: { kind: "third", of: ["D", "E", "F"] } },
  "r16-4": { home: { kind: "pos", group: "B", pos: 1 }, away: { kind: "third", of: ["A", "D", "E", "F"] } },
  "r16-5": { home: { kind: "pos", group: "D", pos: 2 }, away: { kind: "pos", group: "E", pos: 2 } },
  "r16-6": { home: { kind: "pos", group: "F", pos: 1 }, away: { kind: "third", of: ["A", "B", "C"] } },
  "r16-7": { home: { kind: "pos", group: "E", pos: 1 }, away: { kind: "third", of: ["A", "B", "C", "D"] } },
  "r16-8": { home: { kind: "pos", group: "D", pos: 1 }, away: { kind: "pos", group: "F", pos: 2 } },
};

/** Later rounds: which two fixtures feed each slot (home feeder first). */
export const KO_FEED: Record<string, [string, string]> = {
  "qf-1": ["r16-3", "r16-1"],
  "qf-2": ["r16-5", "r16-6"],
  "qf-3": ["r16-7", "r16-8"],
  "qf-4": ["r16-2", "r16-4"],
  "sf-1": ["qf-2", "qf-4"],
  "sf-2": ["qf-1", "qf-3"],
  final: ["sf-1", "sf-2"],
};

/**
 * UEFA third-place mapping: which group's third each of 1B/1C/1E/1F meets,
 * keyed by the sorted set of groups whose thirds qualified.
 */
const THIRDS_TABLE: Record<string, { B: EGroup; C: EGroup; E: EGroup; F: EGroup }> = {
  ABCD: { B: "A", C: "D", E: "B", F: "C" },
  ABCE: { B: "A", C: "E", E: "B", F: "C" },
  ABCF: { B: "A", C: "F", E: "B", F: "C" },
  ABDE: { B: "D", C: "E", E: "A", F: "B" },
  ABDF: { B: "D", C: "F", E: "A", F: "B" },
  ABEF: { B: "E", C: "F", E: "A", F: "B" },
  ACDE: { B: "E", C: "D", E: "C", F: "A" },
  ACDF: { B: "F", C: "D", E: "C", F: "A" },
  ACEF: { B: "E", C: "F", E: "C", F: "A" },
  ADEF: { B: "E", C: "F", E: "D", F: "A" },
  BCDE: { B: "E", C: "D", E: "B", F: "C" },
  BCDF: { B: "F", C: "D", E: "C", F: "B" },
  BCEF: { B: "F", C: "E", E: "C", F: "B" },
  BDEF: { B: "F", C: "E", E: "D", F: "B" },
  CDEF: { B: "F", C: "E", E: "D", F: "C" },
};

/** 90-minute winner, or shootout winner for drawn knockouts. Null while unresolved. */
export function winnerOf(f: EFixture): string | null {
  if (f.status !== "FINISHED" || f.homeGoals == null || f.awayGoals == null) return null;
  if (f.homeGoals > f.awayGoals) return f.homeTeamId;
  if (f.awayGoals > f.homeGoals) return f.awayTeamId;
  return f.penWinnerTeamId ?? null;
}

/** All groups finished? */
export function groupsComplete(fixtures: EFixture[]): boolean {
  return (["A", "B", "C", "D", "E", "F"] as EGroup[]).every((g) => groupComplete(g, fixtures));
}

/**
 * Fill every knockout slot that can be determined from current results.
 * Pure: returns a new fixtures array; untouched fixtures are the same objects.
 */
export function advanceBracket(fixtures: EFixture[], teams: ETeam[]): EFixture[] {
  const out = fixtures.map((f) => ({ ...f }));
  const byId = new Map(out.map((f) => [f.id, f]));

  // R16 from final group tables.
  if (groupsComplete(out)) {
    const posOf = new Map<string, string>(); // "A1" -> teamId
    for (const g of ["A", "B", "C", "D", "E", "F"] as EGroup[]) {
      const t = groupTable(g, out, teams);
      posOf.set(`${g}1`, t[0].teamId);
      posOf.set(`${g}2`, t[1].teamId);
    }
    const thirds = bestThirds(out, teams);
    const combo = thirds.map((t) => t.group).sort().join("");
    const map = THIRDS_TABLE[combo];
    const thirdOf = new Map(thirds.map((t) => [t.group, t.teamId]));
    const resolveSlot = (s: Slot, hostGroup1: "B" | "C" | "E" | "F" | null): string | null => {
      if (s.kind === "pos") return posOf.get(`${s.group}${s.pos}`) ?? null;
      if (!map || !hostGroup1) return null;
      return thirdOf.get(map[hostGroup1]) ?? null;
    };
    for (const [fid, tpl] of Object.entries(R16_TEMPLATE)) {
      const f = byId.get(fid);
      if (!f) continue;
      // Which group-winner hosts this third (drives the mapping-table column)?
      const host =
        tpl.home.kind === "pos" && tpl.home.pos === 1 && ["B", "C", "E", "F"].includes(tpl.home.group)
          ? (tpl.home.group as "B" | "C" | "E" | "F")
          : null;
      if (!f.homeTeamId) f.homeTeamId = resolveSlot(tpl.home, host);
      if (!f.awayTeamId) f.awayTeamId = resolveSlot(tpl.away, host);
    }
  }

  // QF/SF/Final from knockout winners.
  for (const [fid, [homeFeed, awayFeed]] of Object.entries(KO_FEED)) {
    const f = byId.get(fid);
    if (!f) continue;
    if (!f.homeTeamId) f.homeTeamId = winnerOf(byId.get(homeFeed)!) ?? null;
    if (!f.awayTeamId) f.awayTeamId = winnerOf(byId.get(awayFeed)!) ?? null;
  }
  return out;
}

/** The tournament champion (winner of the final), or null while undecided. */
export function championOf(fixtures: EFixture[]): string | null {
  const final = fixtures.find((f) => f.phase === "final");
  return final ? winnerOf(final) : null;
}
