-- Add the domestic club a player normally plays for (name + logo). Backfilled lazily by the tick
-- function for picked / goalscoring players (API-Football has no bulk club field for a squad call).
alter table public.players add column if not exists club jsonb;
