/**
 * One-off parser for the Scorito-style combined export → public/data/predictions.json.
 * Sheets: "Matches" (Player, Round, Team1, Team2, Pred1, Pred2 — teams as Scorito codes),
 * "Top Scorers" (Player, Scorer Name), "Champion" (Player, Team code).
 * Resolves Scorito team codes + scorer names against the live roster/fixtures and prints a report.
 *   npx tsx scripts/parse-scorito.ts <path-to.xlsx>
 */
import ExcelJS from "exceljs";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Roster, MatchesFile, PredictionsFile, Participant, MatchScorePrediction } from "@shared/types.js";
import { DATA_DIR, slug, writeJson } from "./lib/util.js";

const xlsxPath = process.argv[2];
if (!xlsxPath) { console.error("usage: tsx scripts/parse-scorito.ts <file.xlsx>"); process.exit(1); }

const roster = JSON.parse(readFileSync(resolve(DATA_DIR, "roster.json"), "utf8")) as Roster;
const matchesFile = JSON.parse(readFileSync(resolve(DATA_DIR, "matches.json"), "utf8")) as MatchesFile;

// Scorito (Dutch) 3-letter codes → our team ids.
const CODE_TO_TEAM: Record<string, string> = {
  ALG: "algeria", ARG: "argentina", AUS: "australia", AUT: "austria", BEL: "belgium",
  BOS: "bosnia-and-herzegovina", BRA: "brazil", CAN: "canada", COD: "congo-dr", COL: "colombia",
  CPV: "cape-verde-islands", CRO: "croatia", CUW: "curacao", CZE: "czechia", ECU: "ecuador",
  EGY: "egypt", ENG: "england", ESP: "spain", FRA: "france", GER: "germany", GHA: "ghana",
  HAI: "haiti", IRK: "iraq", IRN: "iran", IVO: "ivory-coast", JAP: "japan", JOR: "jordan",
  MAR: "morocco", MEX: "mexico", NED: "netherlands", NOO: "norway", NZL: "new-zealand",
  OEZ: "uzbekistan", PAN: "panama", PAR: "paraguay", POR: "portugal", QAT: "qatar",
  SAR: "saudi-arabia", SCO: "scotland", SEN: "senegal", SUI: "switzerland", SWE: "sweden",
  TUN: "tunisia", TUR: "turkiye", URU: "uruguay", USA: "usa", ZAF: "south-africa", ZKO: "south-korea",
};

const teamIds = new Set(roster.teams.map((t) => t.id));
// fixture lookup by unordered team-id pair
const pairToMatch = new Map<string, { id: string; home: string; away: string }>();
for (const m of matchesFile.matches) {
  pairToMatch.set([m.homeTeamId, m.awayTeamId].sort().join("|"), { id: m.id, home: m.homeTeamId, away: m.awayTeamId });
}

// scorer name index
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
  .replace(/\bjr\b|\bjnr\b|\bjunior\b/g, "junior").replace(/[.\-']/g, " ").replace(/\s+/g, " ").trim();
const players = roster.players.map((p) => ({ id: p.id, name: p.name, teamId: p.teamId, n: norm(p.name), tokens: norm(p.name).split(" ") }));

// Manual overrides where an abbreviated Scorito name collides with another team's literal record
// or with stale duplicate records — resolved against the official squad api ids.
const SCORER_OVERRIDE: Record<string, string> = {
  "f torres": "spain-ferran-torres",        // Ferran Torres, not the Ecuadorian/Uruguayan "F. Torres"
  "e fernandez": "argentina-e-fernandez-2",  // Enzo Fernández (api 5996, in the squad)
  "l martinez": "argentina-lautaro-martinez", // Lautaro Martínez (api 217, in the squad)
};

interface ScorerMatch { id: string | null; name: string; alts: string[] }
function matchScorer(raw: string): ScorerMatch {
  const q = norm(raw);
  const override = SCORER_OVERRIDE[q];
  if (override) return { id: override, name: raw, alts: [] };
  const qt = q.split(" ");
  const isAbbrev = /^[a-z]\b/.test(qt[0]) && qt.length >= 2; // "k havertz"
  const surname = qt[qt.length - 1];
  const initial = isAbbrev ? qt[0] : null;
  type C = { id: string; name: string; teamId: string; score: number };
  const cand: C[] = [];
  for (const p of players) {
    let score = 0;
    if (p.n === q) score = 100; // exact normalized
    else if (p.tokens[p.tokens.length - 1] === surname) {
      // surname matches; check the front
      if (initial) score = p.tokens[0][0] === initial ? 80 : 40;
      else score = 60;
    } else if (qt.length === 1 && (p.tokens[0] === surname || p.tokens.includes(surname))) score = 70; // mononym (Raphinha)
    if (score > 0) cand.push({ id: p.id, name: p.name, teamId: p.teamId, score });
  }
  cand.sort((a, b) => b.score - a.score);
  if (cand.length === 0) return { id: null, name: raw, alts: [] };
  const top = cand[0].score;
  const tied = cand.filter((c) => c.score === top);
  return { id: tied[0].id, name: raw, alts: tied.length > 1 ? tied.map((c) => `${c.name} [${c.teamId}] ${c.id}`) : [] };
}

const txt = (v: ExcelJS.CellValue) => (v == null ? "" : typeof v === "object" ? String((v as { text?: unknown; result?: unknown }).text ?? (v as { result?: unknown }).result ?? "") : String(v)).trim();
const numv = (v: ExcelJS.CellValue) => { const n = Number(txt(v)); return Number.isFinite(n) && txt(v) !== "" ? n : null; };

function canonical(raw: string): string {
  const l = raw.trim().toLowerCase();
  if (l.startsWith("sarah")) return "Sarah";
  if (l.startsWith("stuart")) return "Stuart";
  return raw.trim();
}

const report: string[] = [];
const codeIssues = new Set<string>();
const fixtureMisses: string[] = [];

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(xlsxPath);
  const M = wb.getWorksheet("Matches")!;
  const S = wb.getWorksheet("Top Scorers")!;
  const C = wb.getWorksheet("Champion")!;

  const byName = new Map<string, Participant>();
  const get = (name: string): Participant => {
    const cn = canonical(name);
    if (!byName.has(cn)) byName.set(cn, { id: slug(cn), name: cn, matchScores: [], topPlayers: [], champion: "" });
    return byName.get(cn)!;
  };

  // --- match scores ---
  M.eachRow((row, n) => {
    if (n === 1) return;
    const player = txt(row.getCell(1).value);
    if (!player) return;
    const c1 = txt(row.getCell(3).value), c2 = txt(row.getCell(4).value);
    const p1 = numv(row.getCell(5).value), p2 = numv(row.getCell(6).value);
    if (p1 == null || p2 == null) return;
    const t1 = CODE_TO_TEAM[c1], t2 = CODE_TO_TEAM[c2];
    if (!t1 || !teamIds.has(t1)) { codeIssues.add(c1); return; }
    if (!t2 || !teamIds.has(t2)) { codeIssues.add(c2); return; }
    const fx = pairToMatch.get([t1, t2].sort().join("|"));
    if (!fx) { fixtureMisses.push(`${c1} v ${c2} (r${txt(row.getCell(2).value)})`); return; }
    const home = fx.home === t1 ? p1 : p2;
    const away = fx.home === t1 ? p2 : p1;
    get(player).matchScores.push({ matchId: fx.id, home, away } as MatchScorePrediction);
  });

  // --- scorers ---
  const scorerResolution = new Map<string, ScorerMatch>();
  S.eachRow((row, n) => {
    if (n === 1) return;
    const player = txt(row.getCell(1).value);
    const scorer = txt(row.getCell(2).value);
    if (!player || !scorer) return;
    if (!scorerResolution.has(scorer)) scorerResolution.set(scorer, matchScorer(scorer));
    const m = scorerResolution.get(scorer)!;
    if (m.id && !get(player).topPlayers.includes(m.id)) get(player).topPlayers.push(m.id);
  });

  // --- champion ---
  C.eachRow((row, n) => {
    if (n === 1) return;
    const player = txt(row.getCell(1).value);
    const code = txt(row.getCell(2).value);
    if (!player) return;
    const tid = CODE_TO_TEAM[code];
    if (tid && teamIds.has(tid)) get(player).champion = tid;
    else if (code) codeIssues.add(code);
  });

  const participants = [...byName.values()];

  // Manual corrections where the Scorito export cell was wrong (confirmed against the player).
  // (Will's earlier C-2/G-1 fixes are now baked into the corrected export, so no overrides needed.)
  const MATCH_OVERRIDE: Record<string, Record<string, [number, number]>> = {};
  for (const p of participants) {
    const ov = MATCH_OVERRIDE[p.name];
    if (!ov) continue;
    for (const [mid, [h, a]] of Object.entries(ov)) {
      const ms = p.matchScores.find((m) => m.matchId === mid);
      if (ms) { ms.home = h; ms.away = a; } else p.matchScores.push({ matchId: mid, home: h, away: a } as MatchScorePrediction);
    }
  }

  // ---- report ----
  console.log(`\n=== PARTICIPANTS (${participants.length}) ===`);
  for (const p of participants) {
    console.log(`  ${p.name}: ${p.matchScores.length} scores, ${p.topPlayers.length} scorers, champion=${p.champion || "—"}`);
  }
  console.log(`\n=== SCORER RESOLUTION (${scorerResolution.size}) ===`);
  for (const [raw, m] of scorerResolution) {
    const tag = !m.id ? "  ✗ UNMATCHED" : m.alts.length ? "  ⚠ AMBIGUOUS" : "  ✓";
    const pl = m.id ? players.find((x) => x.id === m.id) : null;
    console.log(`${tag}  "${raw}" -> ${pl ? `${pl.name} [${pl.teamId}] ${pl.id}` : "(none)"}${m.alts.length ? `  | alts: ${m.alts.join("; ")}` : ""}`);
  }
  if (codeIssues.size) console.log(`\n⚠ UNKNOWN TEAM CODES: ${[...codeIssues].join(", ")}`);
  if (fixtureMisses.length) console.log(`\n⚠ FIXTURE MISSES (${fixtureMisses.length}): ${[...new Set(fixtureMisses)].slice(0, 10).join(", ")}`);

  const out: PredictionsFile = { updatedAt: new Date().toISOString(), participants };
  writeJson("predictions.json", out);
  console.log(`\nWrote predictions.json (${participants.length} participants).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
