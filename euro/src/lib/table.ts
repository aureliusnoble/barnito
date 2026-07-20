// Group tables + best-thirds ranking from FINISHED fixtures.
// Mock tiebreak order: points → goal difference → goals for → team rating.

import type { EFixture, ETeam, EGroup } from "../types";

export interface TableRow {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  pos: number;
}

export function groupTable(group: EGroup, fixtures: EFixture[], teams: ETeam[]): TableRow[] {
  const ids = teams.filter((t) => t.group === group).map((t) => t.id);
  const rows = new Map<string, TableRow>(
    ids.map((id) => [id, { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, pos: 0 }]),
  );
  for (const f of fixtures) {
    if (f.phase !== "group" || f.group !== group || f.status !== "FINISHED") continue;
    if (!f.homeTeamId || !f.awayTeamId || f.homeGoals == null || f.awayGoals == null) continue;
    const h = rows.get(f.homeTeamId), a = rows.get(f.awayTeamId);
    if (!h || !a) continue;
    h.played++; a.played++;
    h.gf += f.homeGoals; h.ga += f.awayGoals;
    a.gf += f.awayGoals; a.ga += f.homeGoals;
    if (f.homeGoals > f.awayGoals) { h.won++; a.lost++; h.points += 3; }
    else if (f.homeGoals < f.awayGoals) { a.won++; h.lost++; a.points += 3; }
    else { h.drawn++; a.drawn++; h.points++; a.points++; }
  }
  const rating = new Map(teams.map((t) => [t.id, t.rating]));
  const out = [...rows.values()];
  for (const r of out) r.gd = r.gf - r.ga;
  out.sort(
    (x, y) =>
      y.points - x.points || y.gd - x.gd || y.gf - x.gf || (rating.get(y.teamId) ?? 0) - (rating.get(x.teamId) ?? 0),
  );
  out.forEach((r, i) => (r.pos = i + 1));
  return out;
}

/** True once all 6 of a group's fixtures are FINISHED. */
export function groupComplete(group: EGroup, fixtures: EFixture[]): boolean {
  const gf = fixtures.filter((f) => f.phase === "group" && f.group === group);
  return gf.length === 6 && gf.every((f) => f.status === "FINISHED");
}

/** The four best third-placed teams (with their groups), ranked. */
export function bestThirds(fixtures: EFixture[], teams: ETeam[]): { group: EGroup; teamId: string }[] {
  const groups: EGroup[] = ["A", "B", "C", "D", "E", "F"];
  const rating = new Map(teams.map((t) => [t.id, t.rating]));
  const thirds = groups.map((g) => ({ group: g, row: groupTable(g, fixtures, teams)[2] })).filter((x) => !!x.row);
  thirds.sort(
    (x, y) =>
      y.row.points - x.row.points ||
      y.row.gd - x.row.gd ||
      y.row.gf - x.row.gf ||
      (rating.get(y.row.teamId) ?? 0) - (rating.get(x.row.teamId) ?? 0),
  );
  return thirds.slice(0, 4).map((x) => ({ group: x.group, teamId: x.row.teamId }));
}
