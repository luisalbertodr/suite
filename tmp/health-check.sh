#!/bin/bash
echo -n "SCALE_INGEST_SECRET_len="
docker exec supabase-edge-functions printenv SCALE_INGEST_SECRET 2>/dev/null | wc -c
if [ -f /root/supabase-project/volumes/functions/scale-ingest/index.ts ]; then echo FUNC_OK; else echo FUNC_MISSING; fi
docker exec supabase-db psql -U postgres -d postgres -tAc "SELECT count(*) FROM information_schema.columns WHERE table_name='inbody_measurements' AND column_name='device';"
curl -s https://supabase.lipoout.com/functions/v1/scale-ingest | head -c 300
echo
