SELECT month_num, company_id::text, total
FROM dashboard_billing_monthly_split(2026)
ORDER BY month_num, company_id;
