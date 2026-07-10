SELECT month_num, round(total::numeric, 2) AS total
FROM public.dashboard_billing_monthly('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, 2026)
ORDER BY month_num;

SELECT round(sum(total)::numeric, 2) AS total_2026
FROM public.dashboard_billing_monthly('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, 2026);

SELECT day, round(total::numeric, 2) AS total
FROM public.dashboard_billing_daily(
  '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
  '2026-07-01'::date,
  current_date
)
ORDER BY day;
