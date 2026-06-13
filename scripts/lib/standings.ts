import type { StandingRow } from "@shared/types.js";

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
 * Compute a fully-ordered group table. Deterministic tiebreakers:
 *   points → goal difference → goals scored → head-to-head (mini points/GD/GF)
 *   → alphabetical by team name (stable final tiebreak so re-runs never reorder).
 *
 * Used both for participants' predicted tables and as a local fallback for the
 * actual table when the API doesn't provide ranks.
 */
export function computeGroupTable(
  teamIds: string[],
  results: GroupResult[],
  nameOf: (teamId: string) => string,
): StandingRow[] {
  const table = applyResults(teamIds, results);

  const sorted = [...teamIds].sort((a, b) => {
    const ta = table.get(a)!;
    const tb = table.get(b)!;
    if (tb.points !== ta.points) return tb.points - ta.points;
    if (tb.gd !== ta.gd) return tb.gd - ta.gd;
    if (tb.gf !== ta.gf) return tb.gf - ta.gf;
    return 0; // resolve remaining ties (incl. head-to-head) in the cluster pass below
  });

  // Re-rank clusters that are equal on (points, gd, gf) using head-to-head, then name.
  const keyOf = (id: string) => {
    const t = table.get(id)!;
    return `${t.points}|${t.gd}|${t.gf}`;
  };

  const result: string[] = [];
  let i = 0;
  while (i < sorted.length) {
    let j = i + 1;
    while (j < sorted.length && keyOf(sorted[j]) === keyOf(sorted[i])) j++;
    const cluster = sorted.slice(i, j);
    if (cluster.length > 1) {
      const h2h = headToHead(cluster, results);
      cluster.sort((a, b) => {
        const ha = h2h.get(a)!;
        const hb = h2h.get(b)!;
        if (hb.points !== ha.points) return hb.points - ha.points;
        if (hb.gd !== ha.gd) return hb.gd - ha.gd;
        if (hb.gf !== ha.gf) return hb.gf - ha.gf;
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
