# Barnito — Build Log & TODO

Living checklist for building the World Cup 2026 prediction game. Updated as work progresses.
See the approved plan for the full design. This file tracks status, decisions, and issues hit.

## Legend
- [ ] not started · [~] in progress · [x] done · ⚠️ issue/needs attention

---

## 1. Project scaffold
- [x] package.json, tsconfig, vite, tailwind, postcss, index.html
- [x] `npm install`
- [x] shared types (`shared/types.ts`)
- [x] base path set to `/barnito/` for GitHub Pages (override via BARNITO_BASE)
- [ ] verify dev server + `npm run build`

## 2. Data pipeline (scripts/)
- [x] `shared/constants.ts` — scoring constants, group/team config
- [x] `scripts/lib/standings.ts` — derive group table + deterministic tiebreakers (+ tests)
- [x] `scripts/seed-from-openfootball.ts` — dev seed roster/matches/standings (synthetic mid-tournament)
- [x] `scripts/seed-predictions.ts` — sample participants for the demo
- [x] `scripts/score.ts` — scoring CLI → scores.json
- [x] `scripts/build-roster.ts` — full roster + positions from API-Football (manual/local, needs key)
- [x] `scripts/parse-predictions.ts` — exceljs parser, labels→IDs, fail loudly w/ fuzzy hints (tested)
- [x] `scripts/make-template.ts` — Excel template with dropdown validation (exceljs)
- [x] `scripts/fetch-data.ts` — API-Football fetch, self-throttle, local standings, merge overrides
- note: swapped `xlsx` → `exceljs` (free xlsx can't write dropdown data-validation)

## 3. Scoring engine + tests
- [x] exact=45, outcome=30, draw handling
- [x] scorer points (32/16/8, own goals excluded)
- [x] predicted standings + 25/correct position, only when group final
- [x] champion +250 at tournament end only
- [x] spiciness metric for upcoming matches
- [x] vitest unit tests passing (17 tests green)

## 4. Frontend (mobile-first)
- [x] Layout + bottom nav (mobile) / top nav (desktop)
- [x] Today page (live scores + next-matchday fallback + leader strip)
- [x] Matches page + match detail modal (per-participant predictions & points)
- [x] Leaderboard page (with expandable breakdown)
- [x] Groups page (12 group tables + predicted-order overlay)
- [x] Scorers page (per-person picks + most-picked view)
- [x] Spicy page (upcoming swing-potential ranking, chili heat)
- [x] MLG airhorn (Web Audio synth) + confetti button (bottom-left)
- [x] responsive polish + empty/loading/error states
- [x] full-app render smoke test (jsdom) — all pages + modal, 20 tests green
- [x] `npm run build` succeeds (208 kB JS / 67 kB gzip)

## 5. CI / deploy
- [x] `.github/workflows/deploy.yml` — build + deploy to Pages (push to main / dispatch)
- [x] `.github/workflows/update-data.yml` — cron (*/10) fetch+score, commit changed JSON
- [x] README with setup steps (API key secret, Pages enable, template distribution)
- [x] overrides.example.json + predictions/ README

## 6. Verification
- [x] tests green (20: scoring, standings, full-app render/modal smoke)
- [x] build succeeds; seed:all regenerates data
- [x] parser round-trip with sample filled templates (success + loud failure paths)
- [~] push branch, confirm workflows (push pending; workflows can't run until on main + secret set)
- [ ] ⚠️ no live browser screenshot possible in sandbox (Chromium download blocked) — verify via `npm run dev`
- [ ] ⚠️ API-Football scripts (build-roster/fetch-data) typecheck but are UNtested live (no key in sandbox)

---

## Decisions / notes
- Stack: Vite + React + TS + Tailwind, HashRouter, base `/barnito/`.
- Live data: API-Football free tier (`league=1, season=2026`), key as secret `API_FOOTBALL_KEY`.
- Seed/dev data: openfootball `2026/worldcup.json` (projected sample data incl. scores+scorers) —
  great for development; real data comes from API-Football at runtime.
- Scoring: exact=45 (15+30), outcome=30, champion=250 (end only), scorer goals ×32/16/8 (own goals
  excluded), standings 25/correct position locked only when a group's 6 matches all finished.
- Standings tiebreak: points → GD → goals scored → predicted H2H → alphabetical (deterministic).

## Data source (resolved 2026-06-13)
- ⚠️ API-Football **free tier has NO access to season 2026** (`{"plan":"Free plans do not have access
  to this season, try from 2022 to 2024."}`). Confirmed via the failed setup run.
- Decision: **paid API-Football Pro** ($19/mo, 7,500 req/day, prepaid, no auto-renew).
- Careful-cost design added per request:
  - cron calls API **only inside live windows** (kickoff−10min … +2h45) or setup (`--full`); else 0 calls.
  - hard daily ceiling `API_DAILY_CAP` (default 400) tracked in `public/data/_api-usage.json`.
  - local standings (no `/standings` after setup); event fetches capped per run.
  - `scripts/verify-api.ts` + `verify-api.yml` — cheap (~4 calls) preflight: confirms 2026 access + prints daily limit.
- API client hardened: per-minute throttle + 429/rate-message backoff.

### Pending USER actions (live data)
- [ ] Subscribe to API-Football **Pro**; ensure secret `API_FOOTBALL_KEY` is the paid key.
- [ ] Set repo **default branch = main** (needed for cron + post-data redeploy).
- [ ] Run **Verify API key** workflow → expect `✅ Looks good`.
- [ ] Run **Setup data (one-time)** workflow → commits real roster/fixtures/scores.
- note: I can't dispatch workflows via the integration (403); these are one-click in the Actions tab.

### Status
- [x] main created & pushed; demo site deployed (synthetic data) at https://aureliusnoble.github.io/barnito/
- [x] setup-data made manual-only (was auto-failing on free key)
- [x] Pro plan verified live (72 fixtures, 12+1 groups, positions present, 0/7500 used)

## v2 enhancements (paid API confirmed) — done
- [x] 2026 design system: lucide icons, crests/photos, emerald accent, Inter+Bricolage, motion
- [x] Crest (logo→flag) + Avatar (photo→initials) primitives
- [x] Match modal: event timeline, live stat bars, lineups, top performers (ratings)
- [x] Golden Boot race (picked-player highlight), injuries flags, group form dots, forecast chips
- [x] live auto-refresh (45s while a match is live)
- [x] data contract extended; seed emits events/lineups/stats/ratings/venues + stats/injuries/forecasts.json
- [x] build-roster: team crests/codes/venues; fetch-data: batched /fixtures?ids embedded details +
      topscorers/injuries/predictions, cost-gated; all typecheck, 20 tests + build green
- note: pipeline (build-roster/fetch-data) still UNtested live — runs at user's setup.

## v3 requests (2026-06-13) — done
- [x] A. Live matches award no points until FINISHED; live modal highlights "on the score"/"on the result".
- [x] B. Real copyright-free airhorn: generated public/airhorn.wav (synthesised); button plays it.
- [x] C. Spicy redesigned: hero "don't miss" + clean heat-bar list; focuses next 7 days.
- [x] D. Knockout bracket (bracket.json + fetch-data capture) as Knockouts toggle on Matches; placeholder until drawn.
- [x] E. Lineups (pre @45m + post) + stadium name/city in modal. FIFA ranking + weather NOT in API → skipped.
- [x] F. Nav kept at 6 tabs (bracket folded into Matches); animated active indicator + bigger tap targets.
- [x] G. Design pass: route transitions, Now-hub teasers, prediction-split donut (replaced win-prob), sleekness.
- [x] H. Real data merged + cleaned + rescored under new rules; daily full refresh added (knockout draw/fixtures).

## Deploy note
- ⚠️ github-pages env only allows the repo DEFAULT branch (currently the working branch) to deploy →
  main deploys were rejected. Bridge: deploy.yml also triggers on the working branch. USER must set
  default branch = main (Settings → General) and/or add `main` to github-pages env deployment branches.

- openfootball path `2026/cup.json` is 404; the correct file is `2026/worldcup.json`. Top-level keys
  are `{ name, matches[] }` (104 matches incl. knockout placeholders; 72 are group-stage Group A–L).
- GitHub unauthenticated API rate-limited in this container; using raw.githubusercontent.com instead.
- No live API key available in dev container → roster positions + live scores can't be fetched here;
  `build-roster.ts`/`fetch-data.ts` are validated by structure, real run happens in the Action.
