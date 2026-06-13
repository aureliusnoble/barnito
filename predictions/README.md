# predictions/

Drop each participant's filled-in **`Barnito-Predictions-Template.xlsx`** here, named however
you like (e.g. `barney.xlsx`, `mo.xlsx`). One file per person.

Then run:

```bash
npm run predictions   # parses every .xlsx here → public/data/predictions.json
npm run score         # recompute the leaderboard
```

The parser validates strictly and will **fail loudly** (with "did you mean…?" suggestions) if a
player/team/match can't be matched, so fix the flagged cell and re-run. The dropdowns in the
template prevent almost all of these.

> Generate a fresh template with `npm run template` (after `npm run roster` has built the real
> roster) — it bakes in the canonical fixtures and player/team dropdowns.
