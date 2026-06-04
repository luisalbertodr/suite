\set ON_ERROR_STOP on
\pset format aligned

-- Últimos 5 meses completos antes de junio 2026
WITH months AS (
  SELECT unnest(ARRAY['2026-01','2026-02','2026-03','2026-04','2026-05']) AS ym
),
duna AS (
  SELECT to_char(f.fecfac::date, 'YYYY-MM') AS ym,
         ROUND(SUM(COALESCE(NULLIF(regexp_replace(btrim(f.totfac::text), ',', '.', 'g'), '')::numeric, 0))::numeric, 2) AS total
  FROM legacy.faccab f
  WHERE btrim(coalesce(f.serfac::text, '')) = 'A'
    AND f.fecfac::date >= '2026-01-01' AND f.fecfac::date < '2026-06-01'
    AND upper(btrim(coalesce(f.anulada::text, ''))) NOT IN
        ('S', 'SI', '1', 'T', 'TRUE', 'Y', 'YES', 'X', 'ANULADA', 'A')
  GROUP BY 1
),
inv AS (
  SELECT to_char(i.issue_date, 'YYYY-MM') AS ym,
         public.resolve_invoice_billing_company_id(i.id, '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid) AS billing_co,
         SUM(i.total_amount) AS total
  FROM public.invoices i
  WHERE i.issue_date >= '2026-01-01' AND i.issue_date < '2026-06-01'
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND i.company_id IN (
      '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
    )
  GROUP BY 1, 2
),
sales AS (
  SELECT to_char(s.created_at AT TIME ZONE 'Europe/Madrid', 'YYYY-MM') AS ym,
         s.company_id::text AS co,
         SUM(s.total_amount) AS total
  FROM public.sales s
  WHERE s.status = 'completed'
    AND s.invoice_id IS NULL
    AND s.created_at >= '2026-01-01'::timestamptz
    AND s.created_at < '2026-06-01'::timestamptz
    AND s.company_id IN (
      '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
    )
  GROUP BY 1, 2
),
inv_split AS (
  SELECT ym,
         COALESCE(SUM(total) FILTER (WHERE billing_co = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid), 0) AS medicina,
         COALESCE(SUM(total) FILTER (WHERE billing_co = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid), 0) AS estetica
  FROM inv
  GROUP BY ym
),
sales_split AS (
  SELECT ym,
         COALESCE(SUM(total) FILTER (WHERE co = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'), 0) AS medicina,
         COALESCE(SUM(total) FILTER (WHERE co = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'), 0) AS estetica
  FROM sales
  GROUP BY ym
),
suite AS (
  SELECT m.ym,
         COALESCE(i.medicina, 0) + COALESCE(s.medicina, 0) AS medicina,
         COALESCE(i.estetica, 0) + COALESCE(s.estetica, 0) AS estetica
  FROM months m
  LEFT JOIN inv_split i ON i.ym = m.ym
  LEFT JOIN sales_split s ON s.ym = m.ym
)
SELECT
  m.ym AS mes,
  COALESCE(d.total, 0) AS dunasoft_legacy,
  ROUND(s.medicina::numeric, 2) AS suite_medicina,
  ROUND(s.estetica::numeric, 2) AS suite_estetica,
  ROUND((s.medicina + s.estetica)::numeric, 2) AS suite_total,
  ROUND((s.medicina + s.estetica - COALESCE(d.total, 0))::numeric, 2) AS diferencia,
  CASE WHEN abs(s.medicina + s.estetica - COALESCE(d.total, 0)) < 0.02 THEN 'OK' ELSE 'NO' END AS cuadra
FROM months m
LEFT JOIN duna d ON d.ym = m.ym
LEFT JOIN suite s ON s.ym = m.ym
ORDER BY m.ym;
