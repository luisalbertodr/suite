#!/bin/bash
set -euo pipefail
docker exec -i supabase-db psql -U postgres -d postgres <<'SQL' > /tmp/consultas_sin_cita.csv
\copy (SELECT h.fecha::text AS fecha, c.name AS cliente, coalesce(c.legacy_codcli,'') AS codigo, coalesce(h.motivo_consulta,'') AS motivo, left(coalesce(h.tratamiento,''), 200) AS tratamiento, h.id::text AS historial_id, c.id::text AS customer_id FROM public.historial_clinico h JOIN public.customers c ON c.id = h.customer_id WHERE h.observaciones LIKE '%medicina_estetica_csv_v2%' AND h.appointment_id IS NULL ORDER BY c.name, h.fecha) TO STDOUT WITH CSV HEADER
SQL
wc -l /tmp/consultas_sin_cita.csv
