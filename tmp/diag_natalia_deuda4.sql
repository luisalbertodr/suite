\echo '=== Suite invoices 2025-07-29 ==='
SELECT number, total_amount, status, paid_status, notes
FROM public.invoices i
JOIN public.customers c ON c.id = i.customer_id
WHERE c.legacy_codcli = '002142' AND issue_date = '2025-07-29';

\echo '=== Match legacy A 2025 1341 ==='
SELECT serfac, ejefac, numfac, fecfac, totfac, impcob1, impcob2
FROM legacy.faccab
WHERE trim(codcli)='002142' AND ejefac='2025' AND numfac='1341';

\echo '=== invoice legacy keys if any ==='
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='invoices'
  AND column_name ILIKE '%legacy%' OR (table_schema='public' AND table_name='invoices' AND column_name ILIKE '%numfac%');
