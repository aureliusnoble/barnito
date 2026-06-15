// AUTO-GENERATED from the repo source by scripts/sync-edge-shared.ts — do not edit.
import type { StandingRow } from "./types.ts";

// A completed (or predicted-complete) result between two teams in a group.
export interface GroupResult {
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number;
  awayGoals: number;
}

interface Tally {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
}

function emptyTally(teamId: string): Tally {
  return { teamId, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 };
}

function applyResults(teamIds: string[], results: GroupResult[]): Map<string, Tally> {
  const table = new Map<string, Tally>();
  for (const id of teamIds) table.set(id, emptyTally(id));

  for (const r of results) {
    const home = table.get(r.homeTeamId);
    const away = table.get(r.awayTeamId);
    if (!home || !away) continue; // ignore results referencing teams outside this group
    home.played++; away.played++;
    home.gf += r.homeGoals; home.ga += r.awayGoals;
    away.gf += r.awayGoals; away.ga += r.homeGoals;
    if (r.homeGoals > r.awayGoals) {
      home.won++; home.points += 3; away.lost++;
    } else if (r.homeGoals < r.awayGoals) {
      away.won++; away.points += 3; home.lost++;
    } else {
      home.drawn++; away.drawn++; home.points++; away.points++;
    }
  }
  for (const t of table.values()) t.gd = t.gf - t.ga;
  return table;
}

/**
 * Head-to-head mini-table among a set of tied teams: points, then GD, then GF
 * using only the matches played between those teams.
 */
function headToHead(tiedIds: string[], results: GroupResult[]): Map<string, Tally> {
  const tiedSet = new Set(tiedIds);
  const subset = results.filter((r) => tiedSet.has(r.homeTeamId) && tiedSet.has(r.awayTeamId));
  return applyResults(tiedIds, subset);
}

/**
 * Compute a fully-ordered group table, strictly matching Scorito's predicted-standings
 * tiebreakers (for teams level on points, in order):
 *   head-to-head points → h2h goal difference → h2h goals scored
 *   → overall goal difference → overall goals scored → FIFA ranking
 *   → team name (stable final tiebreak so re-runs never reorder).
 *
 * Used for participants' predicted tables (the actual final table comes from the official source).
 */
export function computeGroupTable(
  teamIds: string[],
  results: GroupResult[],
  nameOf: (teamId: string) => string,
  fifaRankOf: (teamId: string) => number = () => 999,
): StandingRow[] {
  const table = applyResults(teamIds, results);

  // Sort by points; teams level on points are separated within their cluster below.
  const sorted = [...teamIds].sort((a, b) => table.get(b)!.points - table.get(a)!.points);

  const result: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && table.get(sorted[j])!.points === table.get(sorted[i])!.points) j++;
    const cluster = sorted.slice(i, j);
    if (cluster.length > 1) {
      const h2h = headToHead(cluster, results);
      cluster.sort((a, b) => {
        const ha = h2h.get(a)!, hb = h2h.get(b)!;
        if (hb.points !== ha.points) return hb.points - ha.points; // h2h points
        if (hb.gd !== ha.gd) return hb.gd - ha.gd; // h2h goal difference
        if (hb.gf !== ha.gf) return hb.gf - ha.gf; // h2h goals scored
        const ta = table.get(a)!, tb = table.get(b)!;
        if (tb.gd !== ta.gd) return tb.gd - ta.gd; // overall goal difference
        if (tb.gf !== ta.gf) return tb.gf - ta.gf; // overall goals scored
        if (fifaRankOf(a) !== fifaRankOf(b)) return fifaRankOf(a) - fifaRankOf(b); // higher FIFA rank (lower number)
        return nameOf(a).localeCompare(nameOf(b));
      });
    }
    result.push(...cluster);
    i = j;
  }

  return result.map((teamId, idx) => {
    const t = table.get(teamId)!;
    return {
      teamId,
      pos: idx + 1,
      played: t.played,
      won: t.won,
      drawn: t.drawn,
      lost: t.lost,
      gf: t.gf,
      ga: t.ga,
      gd: t.gd,
      points: t.points,
    };
  });
}
