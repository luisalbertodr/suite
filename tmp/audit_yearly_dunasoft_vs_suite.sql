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
duna AS (
  SELECT date_trunc('year', fecfac::date)::date AS y,
    ROUND(SUM(COALESCE(NULLIF(regexp_replace(btrim(totfac::text), ',', '.', 'g'), '')::numeric, 0))::numeric, 2) AS total
  FROM legacy.faccab
  WHERE serfac = 'A'
    AND upper(btrim(coalesce(anulada, ''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X')
  GROUP BY 1
),
suite AS (
  SELECT date_trunc('year', i.issue_date)::date AS y,
    ROUND(SUM(i.total_amount)::numeric, 2) AS total
  FROM invoices i
  WHERE i.company_id IN (
      '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
    )
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
  GROUP BY 1
)
SELECT
  d.y,
  d.total AS dunasoft,
  s.total AS suite,
  ROUND((COALESCE(s.total, 0) - d.total)::numeric, 2) AS diff
FROM duna d
LEFT JOIN suite s ON s.y = d.y
WHERE d.y >= '2012-01-01'
ORDER BY d.y;
