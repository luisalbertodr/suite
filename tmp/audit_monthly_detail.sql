\pset format aligned

-- Enero 2026 desglose
SELECT 'faccab A' AS src, ROUND(SUM(COALESCE(NULLIF(regexp_replace(btrim(totfac::text), ',', '.', 'g'), '')::numeric,0))::numeric,2) t, COUNT(*) c
FROM legacy.faccab WHERE serfac='A' AND fecfac>='2026-01-01' AND fecfac<'2026-02-01'
  AND upper(btrim(coalesce(anulada,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X');

SELECT 'invoices all' AS src, ROUND(SUM(total_amount)::numeric,2), COUNT(*) 
FROM invoices WHERE issue_date>='2026-01-01' AND issue_date<'2026-02-01'
  AND lower(coalesce(status,'')) NOT IN ('cancelled','void','anulada');

SELECT 'invoices estetica co' AS src, ROUND(SUM(total_amount)::numeric,2), COUNT(*)
FROM invoices WHERE issue_date>='2026-01-01' AND issue_date<'2026-02-01'
  AND company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT 'invoices medicina co' AS src, ROUND(SUM(total_amount)::numeric,2), COUNT(*)
FROM invoices WHERE issue_date>='2026-01-01' AND issue_date<'2026-02-01'
  AND company_id='816af484-92a0-4f65-a5a7-1c907aa4bb3d';

SELECT 'sales no inv' AS src, ROUND(SUM(total_amount)::numeric,2), COUNT(*)
FROM sales WHERE status='completed' AND invoice_id IS NULL
  AND created_at>='2026-01-01' AND created_at<'2026-02-01';

SELECT 'resolve med' AS src, ROUND(SUM(i.total_amount)::numeric,2), COUNT(*)
FROM invoices i
WHERE issue_date>='2026-01-01' AND issue_date<'2026-02-01'
  AND resolve_invoice_billing_company_id(i.id,'5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid)='816af484-92a0-4f65-a5a7-1c907aa4bb3d';

SELECT 'resolve est' AS src, ROUND(SUM(i.total_amount)::numeric,2), COUNT(*)
FROM invoices i
WHERE issue_date>='2026-01-01' AND issue_date<'2026-02-01'
  AND resolve_invoice_billing_company_id(i.id,'5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid)='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
