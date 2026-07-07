WITH hub AS (SELECT dunasoft.style_sync_hub_company_id() AS id)
SELECT count(*) AS unmatched
FROM invoice_items ii
JOIN invoices i ON i.id = ii.invoice_id
JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
CROSS JOIN hub
WHERE m.company_id = hub.id AND m.style_key LIKE '2026/%'
  AND NOT EXISTS (
    SELECT 1 FROM articles a
    WHERE a.company_id = hub.id
      AND upper(btrim(a.descripcion)) = upper(btrim(ii.description))
  );
