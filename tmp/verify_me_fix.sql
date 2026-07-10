\pset format aligned

\echo '=== Split mayo 2026 (tras fix) ==='
SELECT company_id,
       CASE company_id
         WHEN '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid THEN 'Delgado Lamas (Medicina)'
         WHEN '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid THEN 'María del Mar (Estética)'
         ELSE 'otro'
       END AS area,
       round(total::numeric, 2) AS total
FROM dashboard_billing_monthly_split(2026)
WHERE month_num = 5
ORDER BY company_id;

\echo '=== Split 2025 completo ==='
SELECT month_num,
       round(sum(total) FILTER (WHERE company_id='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid)::numeric,2) AS medicina,
       round(sum(total) FILTER (WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid)::numeric,2) AS estetica
FROM dashboard_billing_monthly_split(2025)
GROUP BY 1 ORDER BY 1;

\echo '=== Split 2026 completo ==='
SELECT month_num,
       round(sum(total) FILTER (WHERE company_id='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid)::numeric,2) AS medicina,
       round(sum(total) FILTER (WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid)::numeric,2) AS estetica
FROM dashboard_billing_monthly_split(2026)
GROUP BY 1 ORDER BY 1;

\echo '=== by_family mayo medicina ==='
SELECT round(sum(total)::numeric,2) AS med
FROM dashboard_billing_monthly_by_family(2026)
WHERE month_num=5 AND report_company_id='816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid;

\echo '=== by_family mayo estetica ==='
SELECT round(sum(total)::numeric,2) AS est
FROM dashboard_billing_monthly_by_family(2026)
WHERE month_num=5 AND report_company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid;
