\pset format aligned

SELECT i.number, i.issue_date, round(i.total_amount::numeric,2), i.status, m.style_key
FROM invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id
WHERE m.style_key LIKE '%/181/%'
ORDER BY i.number;

SELECT round(sum(ii.total_price)::numeric,2), count(*)
FROM invoice_items ii
JOIN invoices i ON i.id=ii.invoice_id
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id
WHERE m.style_key LIKE '2026/A/181/%';
