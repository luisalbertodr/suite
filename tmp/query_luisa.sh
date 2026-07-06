#!/bin/bash
docker exec supabase-db psql -U postgres -d postgres -t -A -F'|' -c "
SELECT idplan, fecha, horini, nomcli
FROM dunasoft.plan2009
WHERE idplan IN (111755, 111248)
ORDER BY idplan;
"
docker exec supabase-db psql -U postgres -d postgres -t -c "
SELECT count(*) FROM dunasoft.plan2009 WHERE fecha='2026-07-02';
"
