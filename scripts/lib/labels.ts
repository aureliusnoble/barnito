import type { Roster, Player } from "@shared/types.js";

/** Display label for a player in the Excel dropdown. Must be deterministic so the
 *  parser can map the chosen label back to a player id. Collisions get a numeric suffix. */
export function buildPlayerLabels(roster: Roster) {
  const teamName = new Map(roster.teams.map((t) => [t.id, t.name]));
  const labelToId = new Map<string, string>();
  const idToLabel = new Map<string, string>();
  const seen = new Map<string, number>();

  const ordered = [...roster.players].sort(
    (a, b) =>
      (teamName.get(a.teamId) ?? "").localeCompare(teamName.get(b.teamId) ?? "") ||
      a.name.localeCompare(b.name),
  );

  for (const p of ordered) {
    let label = `${p.name} — ${teamName.get(p.teamId) ?? p.teamId} (${p.position})`;
    const n = seen.get(label) ?? 0;
    seen.set(label, n + 1);
    if (n > 0) label = `${label} #${n + 1}`;
    labelToId.set(label, p.id);
    idToLabel.set(p.id, label);
  }
  return { labels: [...labelToId.keys()], labelToId, idToLabel };
}

export function playerLabel(player: Player, roster: Roster): string {
  return buildPlayerLabels(roster).idToLabel.get(player.id) ?? player.name;
}

/** Team dropdown labels (champion pick). Team names are unique. */
export function buildTeamLabels(roster: Roster) {
  const labelToId = new Map<string, string>();
  const labels: string[] = [];
  for (const t of [...roster.teams].sort((a, b) => a.name.localeCompare(b.name))) {
    labelToId.set(t.name, t.id);
    labels.push(t.name);
  }
  return { labels, labelToId };
}
