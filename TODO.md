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
- [ ] `scripts/build-roster.ts` — full roster + positions from API-Football (runtime, needs key)
- [ ] `scripts/parse-predictions.ts` — SheetJS parser, names→IDs, fail loudly
- [ ] `scripts/make-template.ts` — generate the Excel prediction template
- [ ] `scripts/fetch-data.ts` — API-Football fetch, self-throttle, merge overrides → matches/standings.json

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
- [ ] `.github/workflows/deploy.yml` — build + deploy to Pages
- [ ] `.github/workflows/update-data.yml` — cron fetch+score, commit changed JSON
- [ ] README with setup steps (API key secret, Pages enable, template distribution)

## 6. Verification
- [ ] tests green
- [ ] build + preview, click through all pages on seed data
- [ ] parser round-trip with sample filled template
- [ ] push branch, confirm workflows

---

## Decisions / notes
- Stack: Vite + React + TS + Tailwind, HashRouter, base `/barnito/`.
- Live data: API-Football free tier (`league=1, season=2026`), key as secret `API_FOOTBALL_KEY`.
- Seed/dev data: openfootball `2026/worldcup.json` (projected sample data incl. scores+scorers) —
  great for development; real data comes from API-Football at runtime.
- Scoring: exact=45 (15+30), outcome=30, champion=250 (end only), scorer goals ×32/16/8 (own goals
  excluded), standings 25/correct position locked only when a group's 6 matches all finished.
- Standings tiebreak: points → GD → goals scored → predicted H2H → alphabetical (deterministic).

## Issues encountered
- openfootball path `2026/cup.json` is 404; the correct file is `2026/worldcup.json`. Top-level keys
  are `{ name, matches[] }` (104 matches incl. knockout placeholders; 72 are group-stage Group A–L).
- GitHub unauthenticated API rate-limited in this container; using raw.githubusercontent.com instead.
- No live API key available in dev container → roster positions + live scores can't be fetched here;
  `build-roster.ts`/`fetch-data.ts` are validated by structure, real run happens in the Action.
