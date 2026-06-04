\pset format aligned

SELECT
  CASE
    WHEN number LIKE 'LEG-%' THEN 'LEG'
    WHEN notes LIKE 'Legacy FACCAB rebuild%' THEN 'rebuild_notes'
    WHEN notes LIKE 'Factura legacy automática%' THEN 'auto'
    WHEN notes LIKE 'Factura legacy sin cita%' THEN 'sin_cita'
    ELSE 'other'
  END AS kind,
  COUNT(*) c,
  ROUND(SUM(total_amount)::numeric, 2) t
FROM invoices
WHERE issue_date >= '2026-01-01' AND issue_date < '2026-02-01'
  AND lower(coalesce(status,'')) NOT IN ('cancelled','void','anulada')
GROUP BY 1 ORDER BY c DESC;

SELECT COUNT(*) faccab_jan FROM legacy.faccab
WHERE serfac='A' AND fecfac>='2026-01-01' AND fecfac<'2026-02-01'
  AND upper(btrim(coalesce(anulada,''))) NOT IN ('S','SI','1','T','TRUE','Y','YES','X');
