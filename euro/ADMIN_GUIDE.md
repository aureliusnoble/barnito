# Barnito 28 — Admin verification guide

Live at **`/barnito/euro/`** (the WC 2026 site is untouched at `/barnito/`).
Everything is mocked client-side (accounts, odds, results) and persists in your
browser's localStorage — different browsers/devices are independent worlds, which
makes testing safe. **Reset everything** in Admin → Danger zone at any time.

## Accounts

Sign-in is a tap-to-enter account picker (mock — no passwords):
Aurelius, Sarah, Stuart, Will Guess Football Good, 8azil, Javier Barndembo,
Robsonaldo, and **Admin** (PIN **2028**).

## 10-minute verification script

1. **Sign in as Admin** (PIN 2028) → More → **Admin panel**.
2. **Time machine** → "Eve of tournament". Every market is open; odds are live.
3. Switch account (More → Switch account) → sign in as **Aurelius**:
   - **Predict → Matches**: open a group game. Each of Home/Draw/Away shows probability,
     decimal odds, and the exact points if right. Pick the *underdog* and note
     the bigger payout. Lock it — the confirm modal spells out
     `10 × round × odds`. After locking, the odds on your pick are frozen.
   - **Predict → Champion**: pick a team, lock (320 pts flat).
   - **Predict → Scorers**: pick exactly 8 forwards, lock — per-goal points shown
     per player (odds × 10 × round).
   - **Predict → Tokens**: place the 12 group tokens, note the "wins by 2 → +X /
     loses by 1 → −X" projections, lock.
4. Back to **Admin** → Time machine → "Groups underway". Try to change a locked
   pick or lock a new one for a started match — correctly refused.
5. Admin → Bulk → **Seed demo picks for everyone** (fills the other six players),
   then **Simulate WHOLE tournament** (locks demo picks round-by-round, then
   plays all 51 games).
6. **Table → Leaderboard**: totals + per-category breakdown bars (results /
   scorers / tokens / champion — tokens can be negative). Expand a player to see
   line-by-line: each scored pick shows the frozen odds it multiplied by.
7. **Table → Tournament**: group tables, best-thirds qualifiers, full bracket
   with penalty notes, champion banner.
8. Admin → Users: inspect any player's locked picks + frozen odds; unlock any
   single item to test re-locking at different odds (odds drift over time — move
   the time machine and watch prices change).

## What matches which rule

| Rule | Where to see it |
|---|---|
| 1 — rounds ×2 | Matches: same odds pick pays 2× more each round (Rules page table) |
| 2 — no standings pts | Leaderboard breakdown has no "standings" category |
| 3 — champion 2× final | Picks → Champion: flat 320 = 2 × (10 × 16) |
| 4 — outcome × odds, locked | Any match card + its lock modal + frozen odds after |
| 5 — scorers × odds ×4/round | Picks → Scorers (8/4/2/2/1 picks; ×1/4/16/64/256) |
| 6 — tokens × margin × odds | Picks → Tokens (18/4/2/1/1 tokens; signed margins) |
