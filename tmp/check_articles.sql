SELECT codigo, legacy_codart, descripcion, familia
FROM articles
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (upper(descripcion) LIKE '%NEUROMOD%' OR upper(descripcion) LIKE '%SCULPTRA%')
LIMIT 15;

SELECT legacy_codart, descripcion, familia
FROM articles
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND legacy_codart IN ('105894','105869','105835')
LIMIT 10;

SELECT ii.description
FROM invoice_items ii
JOIN invoices i ON i.id = ii.invoice_id
JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id
WHERE m.style_key LIKE '2026/5%'
  AND ii.description ~ '\[\d+\]$'
LIMIT 5;
