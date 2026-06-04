-- Diagnóstico: Betha 2026-06-11 Dunasoft vs Suite
\set ON_ERROR_STOP on

SELECT id, name, dunasoft_codemp, company_id, active
FROM public.agenda_employees
WHERE lower(name) LIKE '%betha%'
ORDER BY company_id, name;

\echo '--- legacy.planinc 2026-06-11 (todas las filas) ---'
SELECT codemp, COUNT(*) AS filas,
       COUNT(DISTINCT NULLIF(btrim(idplan::text), '')) AS idplans,
       COUNT(DISTINCT idplaninc) AS idplanincs
FROM legacy.planinc
WHERE COALESCE(
  CASE WHEN fechax::text ~ '^\d{8}$' THEN substring(fechax::text,1,4)||'-'||substring(fechax::text,5,2)||'-'||substring(fechax::text,7,2)
       WHEN fechax::text ~ '^\d{4}-\d{2}-\d{2}' THEN substring(fechax::text,1,10)
       ELSE NULL END,
  CASE WHEN fecha::text ~ '^\d{8}$' THEN substring(fecha::text,1,4)||'-'||substring(fecha::text,5,2)||'-'||substring(fecha::text,7,2)
       WHEN fecha::text ~ '^\d{4}-\d{2}-\d{2}' THEN substring(fecha::text,1,10)
       ELSE NULL END
) = '2026-06-11'
GROUP BY codemp
ORDER BY filas DESC;

\echo '--- planinc Betha (codemp 6 y 06) detalle ---'
SELECT idplaninc, idplan, codemp, tipinc, fecha, fechax, horini, horfin, horinix, horfinx, nomcli, codcli
FROM legacy.planinc
WHERE COALESCE(
  CASE WHEN fechax::text ~ '^\d{8}$' THEN substring(fechax::text,1,4)||'-'||substring(fechax::text,5,2)||'-'||substring(fechax::text,7,2)
       WHEN fechax::text ~ '^\d{4}-\d{2}-\d{2}' THEN substring(fechax::text,1,10)
       ELSE NULL END,
  CASE WHEN fecha::text ~ '^\d{8}$' THEN substring(fecha::text,1,4)||'-'||substring(fecha::text,5,2)||'-'||substring(fecha::text,7,2)
       WHEN fecha::text ~ '^\d{4}-\d{2}-\d{2}' THEN substring(fecha::text,1,10)
       ELSE NULL END
) = '2026-06-11'
  AND ltrim(btrim(codemp::text), '0') IN ('6', '')
  OR btrim(codemp::text) IN ('6', '06')
ORDER BY horini, idplaninc;

\echo '--- agenda_appointments 2026-06-11 por empleado (estética) ---'
SELECT e.name, e.dunasoft_codemp, COUNT(*) AS citas
FROM public.agenda_appointments a
JOIN public.agenda_employees e ON e.id = a.employee_id
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (
    a.appointment_date = '2026-06-11'
    OR (a.start_time::text LIKE '2026-06-11%')
  )
GROUP BY e.name, e.dunasoft_codemp
ORDER BY citas DESC;

\echo '--- citas Betha ese día ---'
SELECT a.id, a.legacy_planinc_id, a.legacy_idplan, a.client_name, a.start_time, a.end_time, a.employee_id, e.name
FROM public.agenda_appointments a
JOIN public.agenda_employees e ON e.id = a.employee_id
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND lower(e.name) LIKE '%betha%'
  AND (
    a.appointment_date = '2026-06-11'
    OR (a.start_time::text LIKE '2026-06-11%')
  );

\echo '--- planinc del día asignadas a Sin asignar en Suite (codemp sin mapeo) ---'
SELECT p.codemp, COUNT(*)
FROM legacy.planinc p
WHERE COALESCE(
  CASE WHEN p.fechax::text ~ '^\d{8}$' THEN substring(p.fechax::text,1,4)||'-'||substring(p.fechax::text,5,2)||'-'||substring(p.fechax::text,7,2)
       WHEN p.fechax::text ~ '^\d{4}-\d{2}-\d{2}' THEN substring(p.fechax::text,1,10)
       ELSE NULL END,
  CASE WHEN p.fecha::text ~ '^\d{8}$' THEN substring(p.fecha::text,1,4)||'-'||substring(p.fecha::text,5,2)||'-'||substring(p.fecha::text,7,2)
       WHEN p.fecha::text ~ '^\d{4}-\d{2}-\d{2}' THEN substring(p.fecha::text,1,10)
       ELSE NULL END
) = '2026-06-11'
  AND NOT EXISTS (
    SELECT 1 FROM public.agenda_employees e
    WHERE e.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
      AND (
        btrim(e.dunasoft_codemp) = btrim(p.codemp::text)
        OR ltrim(btrim(e.dunasoft_codemp), '0') = ltrim(btrim(p.codemp::text), '0')
      )
  )
GROUP BY p.codemp
ORDER BY COUNT(*) DESC
LIMIT 20;
