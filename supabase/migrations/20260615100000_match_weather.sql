-- Venue weather captured during a match (live) or backfilled at kickoff time, then frozen.
-- { temp, humidity, code (WMO), wind, at, coords:{lat,lon} }. Source: Open-Meteo (free, no key).
alter table public.matches add column if not exists weather jsonb;
