-- Barnito schema: teams, players, matches, participants, score history, and computed documents.
-- All reads are public (anon SELECT via RLS); all writes happen through the service role
-- (the `tick` edge function), which bypasses RLS.

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

-- ---------------------------------------------------------------------------
-- teams
-- ---------------------------------------------------------------------------
create table if not exists public.teams (
  id           text primary key,           -- stable slug, e.g. "brazil"
  api_id       integer unique,
  name         text not null,
  code         text,
  group_letter text,                        -- 'A'..'L' (null for not-yet-grouped)
  logo         text,
  venue        jsonb,
  fifa_rank    integer,                     -- seeded; not available from API-Football
  fifa_points  numeric,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- players
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  id              text primary key,         -- slug, e.g. "brazil-vinicius-junior"
  api_id          integer,
  name            text not null,
  team_id         text references public.teams(id) on delete cascade,
  position        text,                      -- 'GK' | 'DEF' | 'MID' | 'FWD'
  goal_multiplier integer,                   -- 32 | 16 | 8
  photo           text,
  number          integer,
  updated_at      timestamptz not null default now()
);
create index if not exists players_team_idx on public.players(team_id);
create index if not exists players_api_idx on public.players(api_id);

-- ---------------------------------------------------------------------------
-- matches  (scalars for realtime/queries + jsonb blobs matching the Match type)
-- ---------------------------------------------------------------------------
create table if not exists public.matches (
  id           text primary key,            -- "A-1" .. plus knockout ids
  api_id       integer unique,
  group_letter text,
  matchday     integer,
  kickoff      timestamptz,
  status       text not null default 'SCHEDULED',  -- SCHEDULED|LIVE|HT|FINISHED
  elapsed      integer,
  home_team_id text,
  away_team_id text,
  home_goals   integer,
  away_goals   integer,
  ground       text,
  venue        jsonb,
  goals        jsonb default '[]'::jsonb,
  events       jsonb,
  lineups      jsonb,
  stats        jsonb,
  ratings      jsonb,
  round        text,                          -- raw API round (for knockout bracket)
  updated_at   timestamptz not null default now()
);
create index if not exists matches_kickoff_idx on public.matches(kickoff);
create index if not exists matches_status_idx on public.matches(status);

-- ---------------------------------------------------------------------------
-- participants (parsed from the Excel predictions)
-- ---------------------------------------------------------------------------
create table if not exists public.participants (
  id           text primary key,            -- slug from name
  name         text not null,
  match_scores jsonb not null default '[]'::jsonb,  -- [{matchId,home,away}]
  top_players  jsonb not null default '[]'::jsonb,  -- [playerId]
  champion     text,
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- score_history (one row per participant per snapshot → "scores over time" chart)
-- ---------------------------------------------------------------------------
create table if not exists public.score_history (
  participant_id text not null references public.participants(id) on delete cascade,
  at             timestamptz not null,
  total          integer not null,
  primary key (participant_id, at)
);
create index if not exists score_history_at_idx on public.score_history(at);

-- ---------------------------------------------------------------------------
-- documents: computed/served JSON blobs (scores, standings, bracket, stats, injuries, playerStats)
-- ---------------------------------------------------------------------------
create table if not exists public.documents (
  key        text primary key,
  data       jsonb not null,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS: public read-only; writes only via service role (which bypasses RLS)
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['teams','players','matches','participants','score_history','documents']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format($p$create policy "public read %1$s" on public.%1$I for select using (true);$p$, t);
  end loop;
end$$;

-- ---------------------------------------------------------------------------
-- Realtime: push changes for the tables that update live
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.documents;
