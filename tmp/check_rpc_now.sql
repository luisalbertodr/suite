SELECT month_num, round(sum(total)::numeric, 2) AS total
FROM dashboard_billing_monthly('816af484-92a0-4f65-a5a7-1c907aa4bb3d', 2026)
GROUP BY 1 ORDER BY 1;
