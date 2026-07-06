#!/bin/bash
docker exec supabase-db psql -U postgres -d postgres -t -A -F'|' -c "
SELECT fecha, count(*) FROM dunasoft.plan2009
WHERE fecha BETWEEN '2026-06-01' AND '2026-08-31'
GROUP BY fecha ORDER BY fecha;
"
