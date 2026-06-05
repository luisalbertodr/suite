\echo '=== Dunasoft faccab A pending (totfac - impcob) ==='
SELECT serfac, ejefac, numfac, fecfac, totfac::numeric, impcob1::numeric, impcob2::numeric,
       GREATEST(totfac::numeric - (COALESCE(NULLIF(TRIM(impcob1),'')::numeric,0) + COALESCE(NULLIF(TRIM(impcob2),'')::numeric,0)), 0) AS pendiente
FROM legacy.faccab
WHERE trim(codcli) = '002142'
  AND COALESCE(TRIM(serfac),'') = 'A'
  AND (anulada IS NULL OR TRIM(anulada) = '' OR LOWER(TRIM(anulada)) IN ('f','false','0','n'))
  AND GREATEST(totfac::numeric - (COALESCE(NULLIF(TRIM(impcob1),'')::numeric,0) + COALESCE(NULLIF(TRIM(impcob2),'')::numeric,0)), 0) > 0.01
ORDER BY fecfac DESC;

\echo '=== Sum pending faccab A ==='
SELECT ROUND(SUM(GREATEST(totfac::numeric - (COALESCE(NULLIF(TRIM(impcob1),'')::numeric,0) + COALESCE(NULLIF(TRIM(impcob2),'')::numeric,0)), 0))::numeric, 2) AS pendiente
FROM legacy.faccab
WHERE trim(codcli) = '002142'
  AND COALESCE(TRIM(serfac),'') = 'A'
  AND (anulada IS NULL OR TRIM(anulada) = '' OR LOWER(TRIM(anulada)) IN ('f','false','0','n'));

\echo '=== planinc unpaid? columns ==='
SELECT column_name FROM information_schema.columns
WHERE table_schema='legacy' AND table_name='planinc'
  AND column_name ~* 'cobr|deu|imp|pag|fac'
ORDER BY 1
LIMIT 30;

\echo '=== agenda appointments pending charge ==='
SELECT id, appointment_date, status, legacy_codcli, client_name
FROM public.agenda_appointments
WHERE legacy_codcli = '002142' OR client_name ILIKE '%natalia rodas%'
ORDER BY appointment_date DESC
LIMIT 10;

\echo '=== sales without invoice pending ==='
SELECT id, ticket_number, total_amount, status, payment_method, created_at
FROM public.sales s
JOIN public.customers c ON c.id = s.customer_id
WHERE c.legacy_codcli = '002142'
  AND s.status = 'completed'
ORDER BY created_at DESC
LIMIT 15;
