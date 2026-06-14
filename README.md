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

> **API-Football's *free* tier cannot access season 2026** (it returns "Free plans do not have access
> to this season"). You need the cheapest **paid plan: Pro — $19/month, 7,500 requests/day, all
> seasons, prepaid with no auto-renewal** (<https://www.api-football.com/pricing>). One prepaid month
> covers the group stage and can't silently recur. We use only a tiny fraction of 7,500/day (see
> "Cost & call budget").

1. **Subscribe to API-Football Pro**, copy your key, and add it as the repo secret
   **`API_FOOTBALL_KEY`** (Settings → Secrets and variables → Actions).
2. **Set `main` as the default branch** (Settings → General → Default branch) — the scheduled cron and
   post-data redeploy only run from the default branch.
3. **Enable Pages**: Settings → Pages → Source: **GitHub Actions**. (Custom domain / user root → set
   the `BARNITO_BASE` repo *variable* to `/`.)
4. **Run the "Verify API key" workflow** (Actions tab → Run workflow). ~4 calls; confirms your plan
   sees 2026 and prints your daily limit. Look for `✅ Looks good`.
5. **Run the "Setup data (one-time)" workflow.** It builds `roster.json` (teams, players, positions),
   pulls all fixtures into `matches.json`/`standings.json`, regenerates dummy predictions, scores, and
   commits — then the site redeploys with real data.
6. **Predictions**: `npm run template` → distribute → collect into `predictions/` → run the parser
   (`npm run predictions && npm run score`) and commit, or just keep the dummy predictions for now.

After that, the **`update-data.yml`** cron takes over automatically.

## Cost & call budget

The cron runs every 5 min and is deliberately stingy:

- **Zero API calls** except (a) the one-time setup, (b) one lightweight full refresh/day, and (c)
  inside a live match window (45 min before kickoff → ~2h45 after). No live game → no calls.
- During a live window the job **loops internally (~every 75s)** and commits to `main`, and the app
  reads data **straight from the repo's raw URL** (no rebuild needed) — so scores land in ~1–2 min.
- During a live window it polls every 10 min with **~2 calls**: `/fixtures?live=all`, then one
  batched `/fixtures?ids=…` (up to 20 matches) that returns **events, lineups, live stats and player
  ratings embedded** — so a whole round of simultaneous matches is still ~2 calls.
- Top scorers / injuries refresh at most every ~20 min while live; forecasts (match predictions) only
  on setup / daily. A hard **daily ceiling** (`API_DAILY_CAP`, default 400) tracked in
  `public/data/_api-usage.json` stops runaways, on top of API-Football's own 7,500/day.
- Standings are computed locally (no `/standings` calls after setup).

Realistically that's well under ~150 calls on the busiest match day — a rounding error against 7,500.

## Extra data shown (from API-Football)

Crests & player photos, stadium/city, a full match **event timeline** (goals/cards/subs/VAR),
**lineups**, **live match stats** (possession/shots bars), **player ratings**, the **Golden Boot**
race (highlighting picked players), **injury** flags on picks, group **form** guides, and the API's
**match-prediction** favourite on upcoming games. All gracefully degrade if a feed is missing.

## Admin: fixing data on the fly

If the API misses a goal or you need to award the champion, copy `overrides.example.json` to
`overrides.json`, edit the relevant match (keys are Barnito ids like `A-1`, see `matches.json`), and
push. The cron merges `overrides.json` **last**, so it always wins. Set `tournamentComplete: true`
and `championTeamId` after the final to release the +250s.

## The airhorn 📣

Bottom-left button: plays a real MLG airhorn (`public/airhorn.mp3`) and blasts confetti everywhere.
Falls back to a Web-Audio synth if the file ever fails to load.

## Notes & limitations

- Built and unit/render-tested headless; I couldn't capture a live browser screenshot in the build
  sandbox, so eyeball it with `npm run dev` and tweak Tailwind classes to taste.
- The free API tier does **not** include season 2026 (confirmed) — the paid Pro plan does. The
  "Verify API key" workflow checks this for you.
- Knockouts aren't scored yet (group stage only), but the data shapes are built to extend to them.

---

## v4: Supabase realtime backend

The GitHub-Actions/JSON pipeline was replaced by **Supabase** (Postgres + Realtime + an Edge Function
on pg_cron). This fixes the stuck-"live" and stale-fixture bugs (a server job reconciles **all**
fixtures every few minutes and polls live games every ~30s) and pushes updates to phones instantly via
Realtime. The frontend stays static on GitHub Pages and reads from Supabase (publishable key + RLS).

- DB schema/RLS/realtime/cron: `supabase/migrations/*`
- Ingester + scorer (Deno): `supabase/functions/tick` (reuses the scoring engine via `npm run sync:edge`)
- Client data layer: `src/data/{supabase,store}.ts` (realtime subscriptions)

### One-time setup (run locally — Supabase isn't reachable from the build sandbox)
```bash
export SUPABASE_ACCESS_TOKEN=...        # Account → Access Tokens
export SUPABASE_DB_PASSWORD=...         # Project Settings → Database
export SUPABASE_SERVICE_ROLE_KEY=...    # Project Settings → API → service_role
export API_FOOTBALL_KEY=...
./supabase-setup.sh                     # link, db push, secrets, deploy fn, first ingest
```
Then publish the new frontend: **Actions → Deploy to GitHub Pages → Run workflow**.

### Predictions → DB
```bash
npm run db:pull            # roster/fixtures from Supabase → local JSON (for the template/parser)
npm run template           # generate the Excel template
npm run predictions        # parse predictions/*.xlsx → predictions.json (validates)
SUPABASE_SERVICE_ROLE_KEY=... npm run predictions:upload   # → Supabase participants
```

> FIFA rankings aren't in API-Football — they're seeded from `supabase/functions/_shared/fifaRanks.ts`
> (estimates; edit to refresh).
