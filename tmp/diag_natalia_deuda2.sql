\echo '=== All invoices statuses for Natalia ==='
SELECT status, paid_status, COUNT(*), SUM(total_amount::numeric)
FROM public.invoices i
JOIN public.customers c ON c.id = i.customer_id
WHERE c.legacy_codcli = '002142'
GROUP BY status, paid_status
ORDER BY 1, 2;

\echo '=== Unpaid-ish invoices (not paid) ==='
SELECT number, issue_date, total_amount, status, paid_status
FROM public.invoices i
JOIN public.customers c ON c.id = i.customer_id
WHERE c.legacy_codcli = '002142'
  AND (paid_status IS NULL OR paid_status = false)
ORDER BY issue_date DESC;

\echo '=== Sum if we include sent status ==='
SELECT SUM(total_amount::numeric)
FROM public.invoices i
JOIN public.customers c ON c.id = i.customer_id
WHERE c.legacy_codcli = '002142'
  AND (paid_status IS NULL OR paid_status = false)
  AND status NOT IN ('cancelled', 'void', 'anulada');

\echo '=== legacy faccab columns ==='
SELECT column_name FROM information_schema.columns
WHERE table_schema='legacy' AND table_name='faccab'
  AND column_name ~* 'imp|pend|cobr|deu|sal|tot|cli|fac'
ORDER BY 1;

\echo '=== legacy faccab for 002142 ==='
SELECT *
FROM legacy.faccab
WHERE trim(codcli) IN ('002142', '2142')
LIMIT 5;
