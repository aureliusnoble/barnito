/**
 * Parse every filled template in predictions/*.xlsx into public/data/predictions.json.
 * Validates loudly: unknown players/teams/matches, missing names, duplicate participants,
 * and half-filled scorelines all fail the run with a clear, fixable message.
 * Run: npm run predictions
 */
import ExcelJS from "exceljs";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import type {
  Roster, MatchesFile, PredictionsFile, Participant, MatchScorePrediction,
} from "@shared/types.js";
import { REPO_ROOT, DATA_DIR, slug, writeJson } from "./lib/util.js";
import { buildPlayerLabels, buildTeamLabels } from "./lib/labels.js";
import { TOP_PLAYER_PICKS } from "@shared/constants.js";

const roster = JSON.parse(readFileSync(resolve(DATA_DIR, "roster.json"), "utf8")) as Roster;
const matchesFile = JSON.parse(
  readFileSync(resolve(DATA_DIR, "matches.json"), "utf8"),
) as MatchesFile;
const validMatchIds = new Set(matchesFile.matches.map((m) => m.id));
const { labelToId: playerLabelToId, labels: allPlayerLabels } = buildPlayerLabels(roster);
const { labelToId: teamLabelToId, labels: allTeamLabels } = buildTeamLabels(roster);

const PREDICTIONS_DIR = resolve(REPO_ROOT, "predictions");

const errors: string[] = [];
const warnings: string[] = [];

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
  return dp[m][n];
}
function closest(value: string, options: string[]): string | null {
  let best: string | null = null;
  let bestD = Infinity;
  for (const o of options) {
    const d = levenshtein(value.toLowerCase(), o.toLowerCase());
    if (d < bestD) { bestD = d; best = o; }
  }
  return bestD <= Math.max(3, value.length / 2) ? best : null;
}

function str(v: ExcelJS.CellValue): string {
  if (v == null) return "";
  if (typeof v === "object" && "richText" in v)
    return (v.richText as { text: string }[]).map((t) => t.text).join("").trim();
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text).trim();
  if (typeof v === "object" && "result" in v) return String((v as { result: unknown }).result).trim();
  return String(v).trim();
}
function num(v: ExcelJS.CellValue): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(str(v));
  return Number.isFinite(n) ? n : null;
}

async function parseFile(path: string, file: string): Promise<Participant | null> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const where = (msg: string) => `[${file}] ${msg}`;

  const startSheet = wb.getWorksheet("Start Here");
  const name = startSheet ? str(startSheet.getCell("B2").value) : "";
  if (!name) {
    errors.push(where("Missing name in 'Start Here'!B2."));
    return null;
  }

  // --- scores ---
  const scoreSheet = wb.getWorksheet("Match Scores");
  const matchScores: MatchScorePrediction[] = [];
  if (!scoreSheet) {
    errors.push(where("Missing 'Match Scores' sheet."));
  } else {
    scoreSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header
      const id = str(row.getCell("A").value);
      if (!id) return;
      if (!validMatchIds.has(id)) {
        errors.push(where(`Unknown Match ID "${id}" (row ${rowNumber}).`));
        return;
      }
      const hg = num(row.getCell("G").value);
      const ag = num(row.getCell("H").value);
      if (hg == null && ag == null) return; // not predicted — allowed
      if (hg == null || ag == null) {
        errors.push(where(`Match ${id} (row ${rowNumber}) has only one score filled in.`));
        return;
      }
      if (hg < 0 || ag < 0) {
        errors.push(where(`Match ${id} (row ${rowNumber}) has a negative score.`));
        return;
      }
      matchScores.push({ matchId: id, home: hg, away: ag });
    });
  }
  if (matchScores.length === 0)
    warnings.push(where(`No match scores filled in for ${name}.`));

  // --- top players ---
  const playerSheet = wb.getWorksheet("Top 6 Players");
  const topPlayers: string[] = [];
  if (!playerSheet) {
    errors.push(where("Missing 'Top 6 Players' sheet."));
  } else {
    for (let i = 0; i < TOP_PLAYER_PICKS; i++) {
      const label = str(playerSheet.getCell(`B${3 + i}`).value);
      if (!label) continue;
      const id = playerLabelToId.get(label);
      if (!id) {
        const hint = closest(label, allPlayerLabels);
        errors.push(where(`Pick #${i + 1} "${label}" not recognised.` + (hint ? ` Did you mean "${hint}"?` : "")));
        continue;
      }
      if (topPlayers.includes(id)) {
        errors.push(where(`Pick #${i + 1} "${label}" is a duplicate.`));
        continue;
      }
      topPlayers.push(id);
    }
    if (topPlayers.length < TOP_PLAYER_PICKS)
      warnings.push(where(`Only ${topPlayers.length}/${TOP_PLAYER_PICKS} players picked for ${name}.`));
  }

  // --- champion ---
  const champSheet = wb.getWorksheet("Champion");
  let champion = "";
  if (!champSheet) {
    errors.push(where("Missing 'Champion' sheet."));
  } else {
    const label = str(champSheet.getCell("B3").value);
    if (!label) {
      warnings.push(where(`No champion picked for ${name}.`));
    } else {
      const id = teamLabelToId.get(label);
      if (!id) {
        const hint = closest(label, allTeamLabels);
        errors.push(where(`Champion "${label}" not recognised.` + (hint ? ` Did you mean "${hint}"?` : "")));
      } else champion = id;
    }
  }

  return { id: slug(name), name, matchScores, topPlayers, champion };
}

async function main() {
  if (!existsSync(PREDICTIONS_DIR)) {
    console.error(`No predictions/ folder found at ${PREDICTIONS_DIR}.`);
    console.error("Add filled-in templates there, or keep the seeded predictions.json for dev.");
    process.exit(1);
  }
  const files = readdirSync(PREDICTIONS_DIR).filter((f) => f.endsWith(".xlsx") && !f.startsWith("~$"));
  if (files.length === 0) {
    console.error(`No .xlsx files in ${PREDICTIONS_DIR}.`);
    process.exit(1);
  }

  console.log(`Parsing ${files.length} prediction file(s):`);
  const participants: Participant[] = [];
  const seenIds = new Map<string, string>();
  for (const file of files) {
    const p = await parseFile(resolve(PREDICTIONS_DIR, file), file);
    if (!p) continue;
    if (seenIds.has(p.id)) {
      errors.push(`Duplicate participant "${p.name}" in ${file} and ${seenIds.get(p.id)}.`);
      continue;
    }
    seenIds.set(p.id, file);
    participants.push(p);
    console.log(`  ✓ ${p.name}: ${p.matchScores.length} scores, ${p.topPlayers.length} players, champion ${p.champion || "—"}`);
  }

  if (warnings.length) {
    console.warn("\nWarnings:");
    warnings.forEach((w) => console.warn("  ! " + w));
  }
  if (errors.length) {
    console.error("\nErrors (fix these and re-run):");
    errors.forEach((e) => console.error("  ✗ " + e));
    process.exit(1);
  }

  const out: PredictionsFile = { updatedAt: new Date().toISOString(), participants };
  console.log("");
  writeJson("predictions.json", out);
  console.log(`  ${participants.length} participants written.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
