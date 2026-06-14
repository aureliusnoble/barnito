#!/usr/bin/env bash
# One-shot Supabase setup for Barnito. Run from the repo root.
# Requires env vars (get them from the Supabase dashboard):
#   SUPABASE_ACCESS_TOKEN     Account → Access Tokens
#   SUPABASE_DB_PASSWORD      Project Settings → Database (reset to reveal)
#   SUPABASE_SERVICE_ROLE_KEY Project Settings → API → service_role (secret)
#   API_FOOTBALL_KEY          your api-football.com key
# Needs: node/npm, and psql (or run the vault step in the SQL editor — see note).
set -euo pipefail
REF=pkzlcfkupayzqphxjjgi

: "${SUPABASE_ACCESS_TOKEN:?set SUPABASE_ACCESS_TOKEN}"
: "${SUPABASE_DB_PASSWORD:?set SUPABASE_DB_PASSWORD}"
: "${SUPABASE_SERVICE_ROLE_KEY:?set SUPABASE_SERVICE_ROLE_KEY}"
: "${API_FOOTBALL_KEY:?set API_FOOTBALL_KEY}"
export SUPABASE_ACCESS_TOKEN

echo "1/7 link project"
npx supabase link --project-ref "$REF" --password "$SUPABASE_DB_PASSWORD"

echo "2/7 sync edge shared modules"
npm run sync:edge

echo "3/7 push migrations (schema + RLS + realtime + cron)"
npx supabase db push --password "$SUPABASE_DB_PASSWORD"

echo "4/7 store service-role key in Vault (so pg_cron can call the function)"
DB="postgresql://postgres:${SUPABASE_DB_PASSWORD}@db.${REF}.supabase.co:5432/postgres"
if command -v psql >/dev/null; then
  psql "$DB" -v ON_ERROR_STOP=1 -c \
    "select vault.create_secret('${SUPABASE_SERVICE_ROLE_KEY}','service_role_key');" \
  || psql "$DB" -c \
    "update vault.secrets set secret='${SUPABASE_SERVICE_ROLE_KEY}' where name='service_role_key';"
else
  echo "  ! psql not found — run this once in the Supabase SQL editor:"
  echo "    select vault.create_secret('<service_role_key>','service_role_key');"
fi

echo "5/7 set the API-Football secret"
npx supabase secrets set "API_FOOTBALL_KEY=${API_FOOTBALL_KEY}" --project-ref "$REF"

echo "6/7 deploy the tick edge function"
npx supabase functions deploy tick --project-ref "$REF"

echo "7/7 first ingest (roster, then a full reconcile)"
URL="https://${REF}.supabase.co/functions/v1/tick"
curl -fsS -X POST "${URL}?mode=roster" -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"; echo
curl -fsS -X POST "${URL}?mode=full"   -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}"; echo

echo "Done ✔  pg_cron now polls every 30s (0 API calls when nothing is live)."
echo "Load predictions later with:  npm run predictions && npm run predictions:upload"
