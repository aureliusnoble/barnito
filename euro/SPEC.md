# Barnito 28 — Euro 2028 Predictor · Build Spec

A brand-new prediction game for UEFA Euro 2028 (UK & Ireland, 24 teams), living at
`/barnito/euro/` alongside the archived World Cup 2026 site. Everything is **mocked
client-side** for now: sign-ins, odds, results. All state persists in one
localStorage blob so the admin can inspect and drive everything from one browser.

## The game (rules as configured — all tunables in `euro/src/config.ts`)

1. **Outcome picks** (every match): pick Home / Draw / Away for the final result (group: full time; knockout: end of extra time).
   Points if correct = `BASE_OUTCOME (10) × OUTCOME_MULT[phase] × decimal odds at lock-in`.
   `OUTCOME_MULT = { group:1, r16:7, qf:20, sf:60, final:180 }` — tuned so each round's total
   result points on offer grow ~1.5× (360/560/800/1200/1800 expected).
   Odds are **frozen per user at the moment they lock in**; drafts change freely, locking
   is permanent, and only locked picks score. ALL of a round's match picks close at the
   round's FIRST kickoff (a bulk "lock all" locks every draft at once).
2. **No points for group standings** (unlike the WC edition). Group tables still shown.
3. **Champion pick**: one team, locked before the tournament's first kickoff.
   Pays `BASE_CHAMPION (400) × outright odds frozen at lock`, uncapped. Favourites pay
   ~1,800–2,600 (podium-swing zone); a longshot that wins pays its full odds. Fair odds
   make the expected value ≈ 400 for every pick.
4. **Scorer picks** (forwards only): per-phase pick sets of
   `SCORER_PICKS = { group:12, r16:8, qf:4, sf:2, final:1 }` (half the games each round).
   Each goal a picked forward scores in that phase =
   `BASE_GOAL (10) × SCORER_MULT[phase] × that player's anytime-scorer odds at lock-in`.
   `SCORER_MULT = { group:1, r16:7, qf:20, sf:60, final:180 }` — with per-goal pricing the pots
   are exactly 180/280/400/600/900: ~1.5× growth at exactly half the results pot every round.
   The whole set locks at once, before the phase's first kickoff.
5. **Tokens**: per phase users get `TOKENS = { group:12, r16:8, qf:4, sf:2, final:1 }`. Assign any
   number of tokens to a team in a match (multiple per match allowed). Each match shows each
   team's **line** (the market's expected goal margin, signed), frozen at lock. Each token scores
   `BASE_TOKEN (10) × (final margin − line) × TOKEN_MULT[phase]`, with
   `TOKEN_MULT = { group:2, r16:4, qf:10, sf:30, final:90 }` scaling the ± swing per round.
   Zero expectation on BOTH sides of every game — only beating the market's margin view pays.
   Finishing short of the line ⇒ **negative points** (`TOKEN_ALLOW_NEGATIVE = true`).
   The phase's whole allocation locks at once, before the phase's first kickoff.
6. **Knockout draws**: outcomes and token margins lock at the END OF EXTRA TIME (a
   draw is a valid pick and pays). Penalties only decide who advances / the champion.

Scoring counts **only FINISHED fixtures** and **only locked predictions**.
All point values round to the nearest integer per item.

## Mock odds engine (`euro/src/lib/odds.ts`)

- Deterministic: seeded by fixture/player ids + the current sim time — same inputs,
  same odds, so everything is verifiable and stable across reloads.
- Outcome probs from team Elo-ish `rating`s (logistic on rating gap, draw prob
  shrinking with the gap), normalised to sum 1. Decimal odds = 1/p (fair, no margin).
- Odds **drift** deterministically over time (slow sinusoid per fixture/outcome) so
  lock timing matters and the admin time machine visibly moves odds.
- Player anytime-scorer prob from player `rating` + team vs opponent strength.
- Outright champion odds: softmax over team ratings (display only).

## Users & auth (mocked)

Seeded accounts: **Admin** (`isAdmin`, PIN `2028`) + Aurelius, Sarah, Stuart, Will,
8azil, Javier, Robsonaldo (no PINs — tap to sign in). Sign-in is a full-screen
account picker; the session is just `sessionUserId` in the blob. Anyone can switch
accounts (it's a mock); the admin PIN is a speed bump, not security.

## Reveal rules

Your own picks always visible to you. **Other users' picks for a match are hidden
until that match kicks off** (sim time). Phase-level picks (scorers/tokens) hidden
until the phase's first kickoff; champion picks hidden until tournament start.
Admin sees everything, always.

## Tournament model

24 teams, groups A–F of 4. 36 group games, R16 (winners + runners-up + 4 best
thirds via the UEFA mapping table), QF, SF, Final = 51 fixtures. Mock schedule
9 June – 9 July 2028 at the nine announced venues (Wembley, Tottenham Hotspur
Stadium, Etihad, Hill Dickinson Stadium, St James' Park, Villa Park, Principality
Stadium, Hampden Park, Aviva Stadium). Knockout fixtures exist from the start with
`homeTeamId/awayTeamId = null` + placeholder labels ("Winner Group A", "R16 W1"…)
until the admin advances the bracket.

Group table order: points → goal difference → goals for → team rating (mock
tiebreak). Best thirds ranked the same way across groups.

## Admin panel powers

- **Time machine**: set/clear simulated "now" (drives kickoff locks, odds drift, reveals).
- **Results**: enter/edit any fixture's score + per-forward goal counts + penalty
  winner for drawn knockouts; mark FINISHED; one-click "simulate" a fixture, a whole
  round, or the whole tournament (samples from the odds model).
- **Bracket**: advance R16/QF/SF/Final from results (auto), with manual override.
- **Users**: view every user's picks/locks/odds snapshots; unlock any single item.
- **Danger zone**: seed demo predictions for all non-admin users; full reset.

## File map & ownership

Core (already written — DO NOT EDIT in page/data agents):
- `euro/src/types.ts` — all shared types
- `euro/src/config.ts` — every tunable + phase labels
- `euro/src/lib/{rng,odds,format,table,bracket,scoring}.ts`
- `euro/src/store/store.tsx` — provider, all actions, persistence, derived scores
- `euro/src/ui/kit.tsx` — design-system primitives
- `euro/src/App.tsx`, `euro/src/main.tsx`, `euro/src/index.css`

Data (data agents):
- `euro/src/data/teams.ts` — `export const TEAMS: ETeam[]` (24, per types.ts)
- `euro/src/data/players.ts` — `export const FORWARDS: EPlayer[]` (~5 per team)
- `euro/src/data/fixtures.ts` — `export const BASE_FIXTURES: EFixture[]` (all 51)

Pages (one agent each; a page owns ONLY its listed files):
- `euro/src/pages/SignIn.tsx`
- `euro/src/pages/Home.tsx`
- `euro/src/pages/Matches.tsx` (+ `euro/src/components/MatchPredictCard.tsx`)
- `euro/src/pages/Scorers.tsx`
- `euro/src/pages/Tokens.tsx`
- `euro/src/pages/Champion.tsx`
- `euro/src/pages/Leaderboard.tsx`
- `euro/src/pages/Tournament.tsx` (group tables + bracket)
- `euro/src/pages/Rules.tsx`
- `euro/src/pages/Admin.tsx`

## Design system (MUST follow — the UI is a full overhaul, no WC green)

Dark midnight-indigo theme. Tailwind families (already in tailwind.config.js):
`ink` (surfaces/text: bg `ink-950`, cards `ink-900`, borders white/[0.06]),
`volt` (electric lime — primary CTA / lock-in / success emphasis),
`punch` (magenta — odds, longshots, risk), `skyx` (blue — probabilities, info),
`mint` (green — points won). Fonts: `font-grotesk` for display/numbers,
Inter for body. Helper classes in index.css: `.e-card`, `.e-card-hover`,
`.e-chip`, `.e-input`, `.e-num`.

Never use `pitch`/`accent`/`spice` classes (those are the WC theme).
Mobile-first: max-w-xl centred column, bottom tab nav, generous tap targets.
Big tabular numerals for odds/points. Every predict surface must show, per option:
**probability % (with a bar), decimal odds, and exact points if right** — and the
lock confirm modal must show the full formula, e.g.
`10 base × 4 (QF) × 7.14 odds = 286 pts`, plus "locking freezes these odds".
