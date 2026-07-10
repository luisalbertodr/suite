DELETE FROM public.dashboard_billing_query_cache
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT public.dashboard_billing_invalidate('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, '2026-06-01'::date);
SELECT public.dashboard_billing_invalidate('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, '2026-07-01'::date);

SELECT month_num, round(total::numeric, 2) AS dashboard
FROM public.dashboard_billing_monthly('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, 2026)
WHERE month_num IN (6, 7)
ORDER BY 1;
