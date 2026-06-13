/**
 * Generate the participant prediction template:
 *   templates/Barnito-Predictions-Template.xlsx
 * Sheets: Start Here (name), Match Scores (72 fixtures), Top 6 Players (dropdowns),
 * Champion (dropdown). Built from the current roster.json + matches.json so team and
 * player dropdowns are canonical and parse cleanly. Run: npm run template
 */
import ExcelJS from "exceljs";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import type { Roster, MatchesFile } from "@shared/types.js";
import { REPO_ROOT, DATA_DIR } from "./lib/util.js";
import { buildPlayerLabels, buildTeamLabels } from "./lib/labels.js";
import { TOP_PLAYER_PICKS } from "@shared/constants.js";

const roster = JSON.parse(readFileSync(resolve(DATA_DIR, "roster.json"), "utf8")) as Roster;
const matchesFile = JSON.parse(
  readFileSync(resolve(DATA_DIR, "matches.json"), "utf8"),
) as MatchesFile;
const teamName = new Map(roster.teams.map((t) => [t.id, t.name]));

const { labels: playerLabels } = buildPlayerLabels(roster);
const { labels: teamLabels } = buildTeamLabels(roster);

const wb = new ExcelJS.Workbook();
wb.creator = "Barnito";
wb.created = new Date();

const ACCENT = "FF16A34A";
const INPUT_FILL = "FFFFF7CD";

// --- Start Here ------------------------------------------------------------
const start = wb.addWorksheet("Start Here");
start.getColumn("A").width = 22;
start.getColumn("B").width = 50;
start.getCell("A1").value = "BARNITO — World Cup 2026 Predictions";
start.getCell("A1").font = { bold: true, size: 16, color: { argb: ACCENT } };
start.getCell("A2").value = "Your name:";
start.getCell("A2").font = { bold: true };
start.getCell("B2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
start.getCell("B2").border = { bottom: { style: "thin" } };
const tips = [
  "",
  "How to fill this in:",
  "1. Put your name in the yellow cell above.",
  "2. 'Match Scores' tab: enter your predicted goals for every group game (yellow columns).",
  `3. 'Top 6 Players' tab: pick ${TOP_PLAYER_PICKS} players from the dropdowns.`,
  "4. 'Champion' tab: pick who wins the whole thing.",
  "",
  "Scoring: exact score = 45 pts, correct result = 30 pts.",
  "Players: 32 pts/goal (GK/DEF), 16 (MID), 8 (FWD) in the group stage.",
  "Standings: 25 pts per correct final group position. Champion: 250 pts.",
  "Only fill the yellow cells — don't rename tabs or move columns.",
];
tips.forEach((t, i) => {
  const cell = start.getCell(`A${4 + i}`);
  cell.value = t;
  if (t.startsWith("How")) cell.font = { bold: true };
});

// --- Match Scores ----------------------------------------------------------
const scores = wb.addWorksheet("Match Scores");
const scoreCols = [
  { header: "Match ID", key: "id", width: 10 },
  { header: "Group", key: "group", width: 8 },
  { header: "MD", key: "md", width: 5 },
  { header: "Date (UTC)", key: "date", width: 18 },
  { header: "Home", key: "home", width: 20 },
  { header: "Away", key: "away", width: 20 },
  { header: "Home Goals", key: "hg", width: 12 },
  { header: "Away Goals", key: "ag", width: 12 },
];
scores.columns = scoreCols;
scores.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
scores.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACCENT } };
scores.views = [{ state: "frozen", ySplit: 1 }];

const ordered = [...matchesFile.matches].sort(
  (a, b) => a.kickoff.localeCompare(b.kickoff) || a.id.localeCompare(b.id),
);
ordered.forEach((m) => {
  const row = scores.addRow({
    id: m.id,
    group: m.group,
    md: m.matchday,
    date: m.kickoff.replace("T", " ").replace("Z", ""),
    home: teamName.get(m.homeTeamId) ?? m.homeTeamId,
    away: teamName.get(m.awayTeamId) ?? m.awayTeamId,
    hg: null,
    ag: null,
  });
  ["G", "H"].forEach((col) => {
    const cell = row.getCell(col);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
    cell.dataValidation = {
      type: "whole",
      operator: "between",
      formulae: [0, 30],
      allowBlank: true,
      showErrorMessage: true,
      error: "Enter a whole number of goals (0–30).",
    };
  });
});

// --- Lists (hidden, for dropdowns) ----------------------------------------
const lists = wb.addWorksheet("Lists");
lists.state = "hidden";
playerLabels.forEach((l, i) => (lists.getCell(`A${i + 1}`).value = l));
teamLabels.forEach((l, i) => (lists.getCell(`B${i + 1}`).value = l));
const playersRange = `Lists!$A$1:$A$${playerLabels.length}`;
const teamsRange = `Lists!$B$1:$B$${teamLabels.length}`;

// --- Top 6 Players ---------------------------------------------------------
const players = wb.addWorksheet("Top 6 Players");
players.getColumn("A").width = 8;
players.getColumn("B").width = 48;
players.getCell("A1").value = `Pick your ${TOP_PLAYER_PICKS} players (use the dropdowns):`;
players.getCell("A1").font = { bold: true };
for (let i = 0; i < TOP_PLAYER_PICKS; i++) {
  const r = 3 + i;
  players.getCell(`A${r}`).value = `#${i + 1}`;
  const cell = players.getCell(`B${r}`);
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
  cell.dataValidation = {
    type: "list",
    allowBlank: false,
    formulae: [playersRange],
    showErrorMessage: true,
    error: "Pick a player from the dropdown list.",
  };
}

// --- Champion --------------------------------------------------------------
const champ = wb.addWorksheet("Champion");
champ.getColumn("A").width = 18;
champ.getColumn("B").width = 30;
champ.getCell("A1").value = "Tournament winner:";
champ.getCell("A1").font = { bold: true };
champ.getCell("A3").value = "Champion";
const champCell = champ.getCell("B3");
champCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: INPUT_FILL } };
champCell.dataValidation = {
  type: "list",
  allowBlank: false,
  formulae: [teamsRange],
  showErrorMessage: true,
  error: "Pick a team from the dropdown list.",
};

const outDir = resolve(REPO_ROOT, "templates");
mkdirSync(outDir, { recursive: true });
const outPath = resolve(outDir, "Barnito-Predictions-Template.xlsx");
await wb.xlsx.writeFile(outPath);
console.log(`Wrote ${outPath}`);
console.log(
  `  ${ordered.length} fixtures, ${playerLabels.length} players, ${teamLabels.length} teams in dropdowns`,
);
