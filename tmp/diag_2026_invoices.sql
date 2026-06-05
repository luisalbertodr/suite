SELECT
  to_char(issue_date, 'YYYY-MM') AS ym,
  CASE
    WHEN notes LIKE 'Legacy FACCAB rebuild%' THEN 'rebuild'
    WHEN number LIKE 'LEG-%' THEN 'leg_number'
    WHEN notes ILIKE '%legacy%' THEN 'legacy_notes'
    ELSE 'other'
  END AS kind,
  COUNT(*),
  ROUND(SUM(total_amount)::numeric, 2) AS total
FROM invoices
WHERE issue_date >= '2026-01-01' AND issue_date < '2026-06-01'
  AND company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
GROUP BY 1, 2
ORDER BY 1, 2;
