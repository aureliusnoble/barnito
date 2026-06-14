/**
 * Pull roster + fixtures from Supabase into public/data/{roster,matches}.json so the Excel
 * template generator and predictions parser keep working against the live data.
 *   npm run db:pull
 */
import { createClient } from "@supabase/supabase-js";
import type { Roster, MatchesFile, Team, Player, Match, GroupLetter } from "@shared/types.js";
import { writeJson } from "./lib/util.js";

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "https://pkzlcfkupayzqphxjjgi.supabase.co";
const key = process.env.VITE_SUPABASE_ANON_KEY || "sb_publishable_OPp3qRTTno8kyl2ZCMtOLg_sLiK0J2b";
const supa = createClient(url, key, { auth: { persistSession: false } });

// PostgREST caps a response at 1000 rows; the players table (~2300) exceeds that, so page through.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function selectAll(table: string): Promise<any[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const out: any[] = [];
  const size = 1000;
  for (let from = 0; ; from += size) {
    const { data, error } = await supa.from(table).select("*").range(from, from + size - 1);
    if (error) throw error;
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) break;
  }
  return out;
}

const [teams, players, matches] = await Promise.all([
  selectAll("teams"),
  selectAll("players"),
  selectAll("matches"),
]);

const roster: Roster = {
  updatedAt: new Date().toISOString(),
  teams: (teams ?? []).map((t): Team => ({
    id: t.id, name: t.name, code: t.code, group: (t.group_letter ?? "?") as GroupLetter, apiId: t.api_id,
    logo: t.logo, venue: t.venue, fifaRank: t.fifa_rank,
  })),
  players: (players ?? []).map((p): Player => ({
    id: p.id, apiId: p.api_id, name: p.name, teamId: p.team_id, position: p.position ?? "FWD",
    goalMultiplier: p.goal_multiplier ?? 8, photo: p.photo, number: p.number,
  })),
};
const matchesFile: MatchesFile = {
  updatedAt: new Date().toISOString(), tournamentComplete: false, championTeamId: null,
  matches: (matches ?? []).map((m): Match => ({
    id: m.id, apiId: m.api_id, group: (m.group_letter ?? "?") as GroupLetter, matchday: m.matchday ?? 1,
    kickoff: m.kickoff, ground: m.ground, venue: m.venue, homeTeamId: m.home_team_id, awayTeamId: m.away_team_id,
    status: m.status, elapsed: m.elapsed, homeGoals: m.home_goals, awayGoals: m.away_goals, goals: m.goals ?? [],
  })).sort((a, b) => (a.kickoff ?? "").localeCompare(b.kickoff ?? "")),
};

console.log("Pulling from Supabase:");
writeJson("roster.json", roster);
writeJson("matches.json", matchesFile);
console.log(`  ${roster.teams.length} teams, ${roster.players.length} players, ${matchesFile.matches.length} matches`);
