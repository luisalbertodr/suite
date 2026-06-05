\echo '=== CUSTOMERS ==='
SELECT id, name, legacy_codcli, dunasoft_codcli, company_id
FROM public.customers
WHERE lower(name) LIKE '%natalia rodas%';

\echo '=== INVOICES (Suite unpaid issued) ==='
SELECT i.number, i.issue_date, i.total_amount, i.status, i.paid_status, i.company_id, c.name
FROM public.invoices i
JOIN public.customers c ON c.id = i.customer_id
WHERE lower(c.name) LIKE '%natalia rodas%'
ORDER BY i.issue_date DESC NULLS LAST
LIMIT 20;

\echo '=== Suite debt sum ==='
SELECT c.name,
       COALESCE(SUM(i.total_amount::numeric), 0) AS suite_debt
FROM public.customers c
LEFT JOIN public.invoices i ON i.customer_id = c.id
  AND i.status = 'issued'
  AND (i.paid_status IS NULL OR i.paid_status = false)
WHERE lower(c.name) LIKE '%natalia rodas%'
GROUP BY c.id, c.name;

\echo '=== legacy.clientes ==='
SELECT codcli, nomcli, deuda
FROM legacy.clientes
WHERE lower(nomcli) LIKE '%natalia rodas%'
   OR trim(codcli) IN ('002142', '2142');
