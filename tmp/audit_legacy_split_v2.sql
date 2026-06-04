\pset format aligned

WITH med_articles AS (
  SELECT upper(btrim(COALESCE(legacy_codart, codigo, ''))) AS cod
  FROM articles
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND (
      billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
      OR familia IN (
        SELECT name FROM article_families
        WHERE billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
      )
    )
    AND btrim(COALESCE(legacy_codart, codigo, '')) <> ''
),
legacy_lines AS (
  SELECT
    to_char(fc.fecfac::date, 'YYYY-MM') AS ym,
    COALESCE(NULLIF(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0) AS line_amt,
    upper(btrim(fl.codart::text)) AS codart
  FROM legacy.faccab fc
  JOIN legacy.faclin fl ON fl.numfac = fc.numfac AND fl.serfac = fc.serfac AND fl.ejefac = fc.ejefac
  WHERE btrim(coalesce(fc.serfac::text, '')) = 'A'
    AND fc.fecfac::date >= '2026-01-01' AND fc.fecfac::date < '2026-06-01'
    AND upper(btrim(coalesce(fc.anulada::text, ''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
),
legacy_split AS (
  SELECT ym,
    ROUND(SUM(line_amt) FILTER (WHERE codart IN (SELECT cod FROM med_articles))::numeric, 2) AS medicina,
    ROUND(SUM(line_amt) FILTER (WHERE codart NOT IN (SELECT cod FROM med_articles))::numeric, 2) AS estetica
  FROM legacy_lines GROUP BY ym
),
suite_split AS (
  SELECT to_char(i.issue_date, 'YYYY-MM') AS ym,
    ROUND(SUM(i.total_amount) FILTER (
      WHERE resolve_invoice_billing_company_id(i.id, '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid)
        = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
    )::numeric, 2) AS medicina,
    ROUND(SUM(i.total_amount) FILTER (
      WHERE resolve_invoice_billing_company_id(i.id, '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid)
        = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    )::numeric, 2) AS estetica
  FROM invoices i
  WHERE i.issue_date >= '2026-01-01' AND i.issue_date < '2026-06-01'
    AND lower(coalesce(i.status,'')) NOT IN ('cancelled','void','anulada')
  GROUP BY 1
),
duna_cab AS (
  SELECT to_char(fecfac::date, 'YYYY-MM') ym,
    ROUND(SUM(COALESCE(NULLIF(regexp_replace(btrim(totfac::text),',','.','g'),'')::numeric,0))::numeric,2) total
  FROM legacy.faccab
  WHERE serfac='A' AND fecfac>='2026-01-01' AND fecfac<'2026-06-01'
    AND upper(btrim(coalesce(anulada,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
  GROUP BY 1
)
SELECT
  m.ym,
  d.total AS dunasoft_total,
  l.medicina AS duna_med,
  l.estetica AS duna_est,
  ROUND((COALESCE(l.medicina,0)+COALESCE(l.estetica,0))::numeric,2) AS duna_med_mas_est,
  s.medicina AS suite_med,
  s.estetica AS suite_est,
  ROUND((COALESCE(s.medicina,0)+COALESCE(s.estetica,0))::numeric,2) AS suite_med_mas_est,
  ROUND((COALESCE(s.medicina,0)+COALESCE(s.estetica,0)-d.total)::numeric,2) AS suite_vs_duna,
  ROUND((COALESCE(l.medicina,0)+COALESCE(l.estetica,0)-d.total)::numeric,2) AS duna_split_vs_total
FROM (SELECT unnest(ARRAY['2026-01','2026-02','2026-03','2026-04','2026-05']) AS ym) m
JOIN duna_cab d ON d.ym = m.ym
LEFT JOIN legacy_split l ON l.ym = m.ym
LEFT JOIN suite_split s ON s.ym = m.ym
ORDER BY m.ym;
