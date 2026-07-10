SELECT
  to_char(issue_date, 'YYYY-MM') AS mes,
  count(*) AS n,
  round(sum(total)::numeric, 2) AS sum_total
FROM public.invoices
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND issue_date >= '2026-06-01'
  AND issue_date < '2026-08-01'
  AND status IS DISTINCT FROM 'cancelled'
  AND number NOT LIKE 'A-2026-%'
GROUP BY 1
ORDER BY 1;

SELECT month_num, round(total::numeric, 2) AS rpc
FROM public.dashboard_billing_monthly('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, 2026)
WHERE month_num IN (6,7);
