-- faccab columns sample
SELECT codemp, serfac, numfac, codcli, totfac, fecfac
FROM legacy.faccab
ORDER BY public.legacy_text_to_date(fecfac) DESC NULLS LAST
LIMIT 10;

-- ¿codemp en otra tabla de factura?
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema='legacy' AND column_name='codemp'
ORDER BY table_name;

-- sale_id en invoices
SELECT i.number, i.sale_id, s.employee_id, ae.name, ae.dunasoft_codemp, i.total_amount
FROM public.invoices i
LEFT JOIN public.sales s ON s.id = i.sale_id
LEFT JOIN public.agenda_employees ae ON ae.id = s.employee_id
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
LIMIT 15;

-- style billing incremental ledger?
SELECT column_name FROM information_schema.columns
WHERE table_schema='dunasoft' AND table_name LIKE '%billing%'
ORDER BY table_name, ordinal_position;
