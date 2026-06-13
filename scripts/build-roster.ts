/**
 * Build public/data/roster.json from API-Football: teams + groups (from standings) and
 * every player with their position (from /players). This is the keystone that links Excel
 * picks ↔ goal events ↔ scoring via stable slugs + API ids.
 *
 * Run LOCALLY and SPARINGLY (it makes ~1 + (teams × pages) requests, which can use most of
 * a free-tier day's 100-request quota). Commit the resulting roster.json. Not run by the cron.
 *
 *   API_FOOTBALL_KEY=xxx npm run roster
 */
import type { Roster, Team, Player, GroupLetter, GoalMultiplier } from "@shared/types.js";
import { GOAL_MULTIPLIER } from "@shared/constants.js";
import {
  apiGet, apiGetAllPages, getRequestCount, mapPosition, groupLetterFrom,
  WC_LEAGUE, WC_SEASON, type ApiStandingRow, type ApiPlayerEntry, type ApiTeamEntry,
} from "./lib/apiFootball.js";
import { slug, writeJson } from "./lib/util.js";

interface StandingsBlock {
  league: { standings: ApiStandingRow[][] };
}

async function main() {
  console.log(`Building roster from API-Football (league ${WC_LEAGUE}, season ${WC_SEASON})…`);

  const standings = await apiGet<StandingsBlock>("standings", { league: WC_LEAGUE, season: WC_SEASON });
  const groups = standings[0]?.league.standings ?? [];
  if (groups.length === 0) throw new Error("No standings returned — is the season active and on your plan?");

  const teams: Team[] = [];
  const teamApiToId = new Map<number, string>();
  for (const groupRows of groups) {
    for (const row of groupRows) {
      const letter = groupLetterFrom(row.group) as GroupLetter | null;
      if (!letter) continue;
      const id = slug(row.team.name);
      teamApiToId.set(row.team.id, id);
      teams.push({ id, name: row.team.name, group: letter, apiId: row.team.id });
    }
  }
  teams.sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name));
  console.log(`  ${teams.length} teams across ${groups.length} groups`);

  // enrich with crest, code and venue from /teams
  const teamEntries = await apiGet<ApiTeamEntry>("teams", { league: WC_LEAGUE, season: WC_SEASON });
  const byApi = new Map(teamEntries.map((e) => [e.team.id, e]));
  for (const t of teams) {
    const e = t.apiId != null ? byApi.get(t.apiId) : undefined;
    if (!e) continue;
    t.logo = e.team.logo ?? null;
    t.code = e.team.code ?? null;
    if (e.venue)
      t.venue = {
        name: e.venue.name ?? null, city: e.venue.city ?? null,
        capacity: e.venue.capacity ?? null, image: e.venue.image ?? null,
      };
  }

  const players: Player[] = [];
  const usedIds = new Set<string>();
  for (const team of teams) {
    const entries = await apiGetAllPages<ApiPlayerEntry>("players", {
      team: team.apiId!, season: WC_SEASON,
    });
    for (const e of entries) {
      const posStr = e.statistics.find((s) => s.games?.position)?.games.position ?? e.player.position;
      const position = mapPosition(posStr);
      let id = `${team.id}-${slug(e.player.name)}`;
      let n = 2;
      while (usedIds.has(id)) id = `${team.id}-${slug(e.player.name)}-${n++}`;
      usedIds.add(id);
      players.push({
        id,
        apiId: e.player.id,
        name: e.player.name,
        teamId: team.id,
        position,
        goalMultiplier: GOAL_MULTIPLIER[position] as GoalMultiplier,
        photo: e.player.photo ?? null,
      });
    }
    console.log(`  ${team.name}: ${entries.length} players`);
  }

  const roster: Roster = { updatedAt: new Date().toISOString(), teams, players };
  writeJson("roster.json", roster);
  console.log(`  done — ${teams.length} teams, ${players.length} players, ${getRequestCount()} API requests used`);
}

main().catch((e) => {
  console.error("build-roster failed:", e.message);
  process.exit(1);
});
