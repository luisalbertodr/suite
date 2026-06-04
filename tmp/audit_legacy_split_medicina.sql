\pset format aligned

-- Clasificación legacy: línea factura → artículo → familia con billing medicina
WITH med_families AS (
  SELECT name FROM article_families
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
),
med_articles AS (
  SELECT upper(btrim(codigo)) AS cod
  FROM articles a
  WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND (
      a.billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
      OR a.familia IN (SELECT name FROM med_families)
    )
),
legacy_lines AS (
  SELECT
    to_char(fc.fecfac::date, 'YYYY-MM') AS ym,
    fc.numfac,
    COALESCE(NULLIF(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0) AS line_amt,
    upper(btrim(fl.codart::text)) AS codart
  FROM legacy.faccab fc
  JOIN legacy.faclin fl
    ON fl.numfac = fc.numfac AND fl.serfac = fc.serfac AND fl.ejefac = fc.ejefac
  WHERE btrim(coalesce(fc.serfac::text, '')) = 'A'
    AND fc.fecfac::date >= '2026-01-01' AND fc.fecfac::date < '2026-06-01'
    AND upper(btrim(coalesce(fc.anulada::text, ''))) NOT IN
        ('S', 'SI', '1', 'T', 'TRUE', 'Y', 'YES', 'X')
),
legacy_split AS (
  SELECT ym,
         ROUND(SUM(line_amt) FILTER (WHERE codart IN (SELECT cod FROM med_articles))::numeric, 2) AS medicina,
         ROUND(SUM(line_amt) FILTER (WHERE codart NOT IN (SELECT cod FROM med_articles) OR codart IS NULL OR codart = '')::numeric, 2) AS estetica
  FROM legacy_lines
  GROUP BY ym
)
SELECT
  l.ym,
  l.medicina AS duna_med,
  l.estetica AS duna_est,
  ROUND((l.medicina + l.estetica)::numeric, 2) AS duna_sum,
  d.total AS duna_cab,
  ROUND((l.medicina + l.estetica - d.total)::numeric, 2) AS duna_split_diff
FROM legacy_split l
JOIN (
  SELECT to_char(fecfac::date, 'YYYY-MM') ym,
         ROUND(SUM(COALESCE(NULLIF(regexp_replace(btrim(totfac::text), ',', '.', 'g'), '')::numeric, 0))::numeric, 2) total
  FROM legacy.faccab
  WHERE serfac='A' AND fecfac>='2026-01-01' AND fecfac<'2026-06-01'
    AND upper(btrim(coalesce(anulada,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
  GROUP BY 1
) d ON d.ym = l.ym
ORDER BY l.ym;
