SELECT left(number, 20) prefix, COUNT(*), ROUND(SUM(total_amount)::numeric,2)
FROM invoices
WHERE issue_date >= '2026-01-01' AND issue_date < '2026-02-01'
  AND lower(coalesce(status,'')) NOT IN ('cancelled','void','anulada')
  AND number NOT LIKE 'LEG-%'
  AND coalesce(notes,'') NOT LIKE 'Legacy FACCAB%'
  AND coalesce(notes,'') NOT LIKE 'Factura legacy%'
GROUP BY 1 ORDER BY 2 DESC LIMIT 15;
