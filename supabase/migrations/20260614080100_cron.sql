-- Schedule the ingester. pg_cron calls the `tick` edge function via pg_net every 30s.
-- The service-role key is read from Supabase Vault (set separately, never committed):
--   select vault.create_secret('<service_role_key>', 'service_role_key');
-- The function self-throttles to zero API calls when nothing is live.

-- remove any previous schedule (id may be a name in recent pg_cron)
do $$ begin perform cron.unschedule('barnito-tick'); exception when others then null; end $$;

select cron.schedule(
  'barnito-tick',
  '30 seconds',  -- sub-minute (pg_cron >= 1.5); change to '* * * * *' if unsupported
  $$
  select net.http_post(
    url := 'https://pkzlcfkupayzqphxjjgi.supabase.co/functions/v1/tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 25000
  );
  $$
);
