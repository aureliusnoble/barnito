# Barnito ⚽ — World Cup 2026 prediction game

A friend-group prediction game (à la Scorito) for the 2026 World Cup **group stage**. Everyone
submits an Excel of predictions; the site shows live scores, per-match predictions & points, a
leaderboard, group tables, goal-scorer standings, and which upcoming games could swing the table
most. Plus a big airhorn 📣.

It's a **fully static site on GitHub Pages** — no server, no database. A scheduled **GitHub Action**
pulls live data from API-Football, recomputes everything, and commits JSON back to the repo; the
React app just renders those JSON files.

## Scoring

| Thing | Points |
| --- | --- |
| Exact scoreline | **45** (15 exact + 30 for the result it implies) |
| Correct result only (W/D/L) | **30** |
| Goal by a picked player (group stage) | **32**/goal GK & DEF · **16** MID · **8** FWD (own goals don't count) |
| Each correct final group position | **25** (locked once that group's 6 games are done) |
| Correct overall champion | **250** (awarded at the end of the tournament) |

Each participant predicts every group-stage scoreline, picks **6 players**, and **1 champion**.
Predicted **group standings are derived from their predicted scorelines** (tiebreak: points → goal
difference → goals scored → head-to-head → alphabetical).

## How it fits together

```
Excel templates ──parse──▶ predictions.json ─┐
API-Football ──fetch (cron)──▶ matches.json ─┼─score──▶ scores.json ──▶ React (static, GitHub Pages)
                              standings.json ─┘
roster.json (teams + players + positions) ───┘
```

- **`scripts/`** — the data pipeline (TypeScript, run with `tsx`).
- **`shared/`** — the data contract + scoring constants shared by pipeline and UI.
- **`src/`** — the Vite + React + Tailwind app.
- **`public/data/*.json`** — the "database" (committed; the cron rewrites match/standings/scores).

## Local development

```bash
npm install
npm run seed:all   # builds demo data (roster/matches/standings) + sample predictions + scores
npm run dev        # http://localhost:5173
npm test           # scoring + standings + full-app render tests
npm run build      # production build into dist/
```

`npm run seed:all` uses the bundled openfootball 2026 schedule and **synthesises** a realistic
mid-tournament state (finished + live + upcoming) so every feature works offline. Real data replaces
it in production.

## Going live (one-time setup)

1. **Get a free API-Football key** at <https://www.api-football.com> (no card needed) and add it as a
   repo secret named **`API_FOOTBALL_KEY`** (Settings → Secrets and variables → Actions).
2. **Build the real roster** (run locally; uses most of a free day's quota, so do it once):
   ```bash
   API_FOOTBALL_KEY=xxx npm run roster      # → public/data/roster.json (teams, players, positions)
   API_FOOTBALL_KEY=xxx npm run fetch -- --full   # → matches.json + standings.json (canonical fixtures)
   ```
3. **Generate & distribute the template**, then collect and parse:
   ```bash
   npm run template            # → templates/Barnito-Predictions-Template.xlsx (with dropdowns)
   # everyone fills it in; drop the files into predictions/
   npm run predictions         # → public/data/predictions.json (validates strictly)
   npm run score               # → public/data/scores.json
   ```
   Commit `public/data/*.json`.
4. **Enable Pages**: Settings → Pages → Source: **GitHub Actions**. Merge to `main` →
   `deploy.yml` publishes the site. (For a custom domain / user-root, set the `BARNITO_BASE`
   repo *variable* to `/`.)

That's it. The **`update-data.yml`** cron then runs every 10 minutes: it self-throttles to **zero API
calls** outside live match windows, polls live scores during them, recomputes scores, and commits any
changes (which redeploys the site).

## Admin: fixing data on the fly

If the API misses a goal or you need to award the champion, copy `overrides.example.json` to
`overrides.json`, edit the relevant match (keys are Barnito ids like `A-1`, see `matches.json`), and
push. The cron merges `overrides.json` **last**, so it always wins. Set `tournamentComplete: true`
and `championTeamId` after the final to release the +250s.

## The airhorn 📣

Bottom-left button: plays an MLG-style airhorn (synthesised with the Web Audio API — no asset, works
offline) and blasts confetti everywhere. Drop a clip at `public/airhorn.mp3` to use a real sample.

## Notes & limitations

- Built and unit/render-tested headless; I couldn't capture a live browser screenshot in the build
  sandbox, so eyeball it with `npm run dev` and tweak Tailwind classes to taste.
- The free API tier limits historical seasons; the **current** (2026) season is included. Confirm on
  your dashboard with `/fixtures?league=1&season=2026` after registering.
- Knockouts aren't scored yet (group stage only), but the data shapes are built to extend to them.
