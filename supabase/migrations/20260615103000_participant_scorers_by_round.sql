-- Per-round top-scorer picks: group stage (6) + each knockout round (4 each).
-- Shape: { group: string[], r32: string[], r16: string[], qf: string[], sf: string[], final: string[] }.
alter table public.participants add column if not exists scorers_by_round jsonb;
