# Barnito — Handover (Supabase migration → finish the deploy)

You're picking up a **World Cup 2026 prediction web app** ("Barnito"). The code for a big migration to
**Supabase** is **done and pushed**; it just needs to be **deployed**, which the previous session
**could not do because its sandbox blocked all Supabase network hosts**. Your job: run the Supabase
setup, publish the new frontend, and verify it end-to-end.

## TL;DR — do this
1. Get 4 secrets (below) and run **`./supabase-setup.sh`** from the repo root.
2. Watch the first ingest (the script curls the edge function) — fix any Deno runtime errors.
3. Publish the new frontend: **Actions → "Deploy to GitHub Pages" → Run workflow** (deploy is
   manual-only right now; see "Deploying the frontend").
4. Open the site, confirm realtime + that live/finished/today/recent all behave.
5. (Later) load the real predictions.

## Repo / branches
- Work on branch **`claude/barnito-world-cup-tracker-0fjkzn`**; **`main`** mirrors it (push to both).
- The **live GitHub Pages site deploys from the working branch** (it's the repo's default branch; the
  `github-pages` environment only allows the default branch — `main` deploys are rejected).
- Latest commit: `b0862c8`. Stack: Vite + React + TS + Tailwind (HashRouter, base `/barnito/`),
  Supabase JS client, lucide. Tests: `npm test` (vitest). Build: `npm run build`.

## Why we migrated (the bugs)
The old pipeline (GitHub Actions cron + committed JSON) had two bugs: finished games stayed "LIVE" for
hours, and played fixtures could show stale (e.g. Scotland–Haiti "not uploaded"). Root cause =
**windowed polling on an unreliable cron** + a brittle fixture filter. Supabase fixes it: a reliable
pg_cron job (~30s) reconciles **all** fixtures every few minutes and pushes updates via **Realtime**.

## Credentials you need (all the user has them)
Set as env vars before running the setup script:
- `SUPABASE_ACCESS_TOKEN` — Supabase Dashboard → Account → Access Tokens.
- `SUPABASE_DB_PASSWORD` — Project Settings → Database (reset to reveal).
- `SUPABASE_SERVICE_ROLE_KEY` — Project Settings → API → `service_role` (secret).
- `API_FOOTBALL_KEY` — the api-football.com (api-sports) **paid Pro** key. Current value the user gave:
  `4223871268e169482ffdd3ec23cb0e6d` (confirm with them).
- Project ref: **`pkzlcfkupayzqphxjjgi`**, URL `https://pkzlcfkupayzqphxjjgi.supabase.co`,
  publishable/anon key `sb_publishable_OPp3qRTTno8kyl2ZCMtOLg_sLiK0J2b` (already baked into
  `src/data/supabase.ts` as a safe fallback).

## What `./supabase-setup.sh` does (and what to watch)
1. `supabase link --project-ref pkzlcfkupayzqphxjjgi`
2. `npm run sync:edge` — copies the scoring engine/types into `supabase/functions/_shared/` (Deno).
3. `supabase db push` — applies `supabase/migrations/*` (tables, RLS public-read, realtime publication,
   pg_cron job).
4. Stores `service_role_key` in **Vault** (so pg_cron can authenticate to the function). Needs `psql`,
   else run in the SQL editor: `select vault.create_secret('<service_role_key>','service_role_key');`
5. `supabase secrets set API_FOOTBALL_KEY=…`
6. `supabase functions deploy tick`
7. First ingest: `curl …/functions/v1/tick?mode=roster` then `?mode=full` (service-role bearer).

**Likely failure points / fixes:**
- **pg_cron `'30 seconds'`** schedule (in `supabase/migrations/20260614080100_cron.sql`) needs pg_cron
  ≥1.5. If `db push` errors on it, change to `'* * * * *'` (1/min) — the function self-throttles anyway.
- **`functions deploy`** should bundle via esbuild (no Docker). If it asks for Docker, ensure a recent
  CLI (`npx supabase@latest`). The function imports `jsr:@supabase/supabase-js@2` — if that errors,
  switch to `npm:@supabase/supabase-js@2` in `supabase/functions/tick/index.ts`.
- The function is **Deno and was never run live** (sandbox blocked Supabase) — the first `mode=roster`
  / `mode=full` curl is the real test. It returns JSON `{ok:…}`; on 500 it returns `{error}` — read the
  function logs (`supabase functions logs tick` or the dashboard) and fix. It uses `Deno.env` for
  `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (auto-injected) and `API_FOOTBALL_KEY` (secret).
- **Realtime**: the migration adds `matches` + `documents` to `supabase_realtime`. Confirm Realtime is
  enabled for the project (Database → Replication / Realtime).
- After `mode=roster` (teams+players, ~100 API calls, slow due to throttling) and `mode=full`, the DB
  should have 48 teams, ~1200+ players, 72 matches, and `documents` rows (`scores`, `standings`,
  `bracket`, `stats`, `injuries`, `playerStats`). The pg_cron then keeps it fresh every 30s.

## Deploying the frontend
`.github/workflows/deploy.yml` is **`workflow_dispatch`-only** right now (so committing the
Supabase-dependent frontend didn't replace the working old site before the backend existed). Once the
backend is verified:
- **Actions → "Deploy to GitHub Pages" → Run workflow** (runs from the default/working branch). OR
  re-add a `push` trigger to `deploy.yml` and push.
- The deployed app reads Supabase via the publishable key + RLS. If it shows "Couldn't load data", the
  backend isn't populated yet or RLS/realtime isn't right.
- (Optional cleanup the user wanted) set the repo **default branch to `main`** + allow `main` in the
  `github-pages` environment, then deploys/PRs key off main and the working-branch quirk goes away.

## Predictions → DB (later)
```bash
npm run db:pull            # Supabase → public/data/{roster,matches}.json (for the template/parser)
npm run template           # → templates/Barnito-Predictions-Template.xlsx
# fill it, drop files in predictions/
npm run predictions        # validate → predictions.json
SUPABASE_SERVICE_ROLE_KEY=… npm run predictions:upload   # → participants table
```
Right now the `participants` table is empty (or has whatever was uploaded). The leaderboard/scores work
off it; with no participants the leaderboard is empty (not an error).

## Architecture map
- `supabase/migrations/*.sql` — schema, RLS, realtime, cron.
- `supabase/functions/tick/index.ts` — ingester + scorer (modes: default tick, `?mode=roster`, `?mode=full`).
- `supabase/functions/_shared/*` — Deno copies of the scoring engine (`scoring.ts`, `standings.ts`,
  `types.ts`, `constants.ts` are AUTO-GENERATED by `npm run sync:edge` — edit the originals in
  `shared/` + `scripts/lib/`, then re-sync), plus hand-written `apiFootball.ts` and `fifaRanks.ts`.
- `src/data/supabase.ts` — client. `src/data/store.tsx` — loads + realtime subscriptions; exposes
  `useBarnito()` / `useHelpers()` (the pages depend only on these).
- `src/pages/*` + `src/components/*` — UI (Now/Recent, Matches+Bracket, Leaderboard+chart, Groups,
  Scorers+player modal, Spicy; MatchModal has team info + H2H; PlayerModal; ScoreChart; AirhornButton).
- `scripts/` — `db-pull.ts`, `upload-predictions.ts`, `sync-edge-shared.ts`, plus the now-legacy
  JSON-pipeline scripts (build-roster/fetch-data/score/seed*) which are unused by the Supabase path.

## Scoring rules (unchanged, in `scripts/lib/scoring.ts`)
Exact scoreline = 45 (15+30), correct result = 30, scorer goals ×32 GK/DEF · 16 MID · 8 FWD (own goals
excluded), each correct final group position = 25 (locked when the group finishes), champion = 250 (at
tournament end). **Live matches award no points until FINISHED**; while live the modal highlights "on the
score"/"on the result". Standings derived from predicted scorelines (tiebreak points→GD→GF→H2H→alpha).

## Further requests (next iteration — after the deploy works)
These are new UI/data asks from the user. For the data ones, **only add if API-Football actually
supports it**; otherwise use a small maintained static fallback (like `_shared/fifaRanks.ts`) and say so.

1. **Match detail: team's most-recent + best World Cup result.** Show, per team, their *most recent*
   World Cup result and their *best-ever* World Cup finish.
   - *Most recent*: likely derivable from API-Football historical seasons (Pro covers all seasons),
     e.g. `/fixtures?team={id}&league=1&season=2022&last=1` (or the latest season the team appears in).
   - *Best-ever finish* (e.g. "Winners 1966", "Semi-finals 2018"): **not a direct API field** — would
     need historical bracket analysis or, more practically, a **maintained static map** (team → best
     finish). Check feasibility; fall back to static if needed.
2. **Player card: the club the player normally plays for.** API-Football can give this via the player's
   domestic stats (`/players?id={id}&season={current}` → `statistics[].team` for a club league) or
   `/transfers?player={id}` (latest `in` club). The national-team season's `statistics.team` is the
   country, so you must pull club info separately. Add a `club` (name + logo) to `players` (and the
   `playerStats`/player modal) if supported; otherwise skip.
3. **Clean redesign of the match detail (the modal opened from a MatchCard).** It's getting cluttered
   (team info, H2H, donut, timeline, stats, performers, lineups, predictions all stacked). Goal:
   - **Header = summary only** (crests, score/status + live minute, kickoff, group/venue).
   - **The predictions table is THE focus** — make it sleek, beautiful, and UX-led: easy to scan who's
     on the exact score vs the result while live, clear points at full time, sensible sorting, good
     density on mobile. Consider it the primary content, with everything else (team info, H2H, timeline,
     stats, lineups) demoted to secondary/collapsible sections below or behind tabs.
   - Keep the dark/emerald + lucide language. This is a focused redesign of `src/components/MatchModal.tsx`.

## Known limitations / notes
- FIFA ranks are **seeded estimates** in `_shared/fifaRanks.ts` (the API has no ranking endpoint).
- The previous sandbox couldn't take browser screenshots — verify the UI on a phone after deploy.
- Smoke test (`src/smoke.test.tsx`) mocks the Supabase client; it validates renders, not live data.
- Commit messages should NOT contain any model identifier. Push to both `main` and the working branch.
