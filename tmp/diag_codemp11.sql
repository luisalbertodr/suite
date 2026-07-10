SELECT m.style_key, m.field_snapshot
FROM dunasoft.style_sync_entity_map m
WHERE m.entity_type='invoice' AND m.style_key LIKE '2026/A/1448%'
LIMIT 3;

SELECT column_name, data_type FROM information_schema.columns
WHERE table_schema='public' AND table_name='agenda_appointments'
  AND column_name IN ('employee_id','legacy_codemp','dunasoft_codemp','invoice_id');

SELECT aa.employee_id, pg_typeof(aa.employee_id)
FROM public.agenda_appointments aa LIMIT 1;

-- plan2009 facturado count by codemp (no importe)
SELECT p.codemp, count(*) 
FROM dunasoft.plan2009 p
WHERE p.fecha BETWEEN '2026-07-01' AND '2026-07-10' AND p.facturado
GROUP BY 1 ORDER BY 2 DESC;

-- match invoice to plan via style key numfac?
SELECT p.codemp, p.idplan, p.fecha, p.nomcli, p.facturado
FROM dunasoft.plan2009 p
WHERE p.fecha BETWEEN '2026-07-01' AND '2026-07-10' AND p.facturado
LIMIT 10;
