SELECT ii.description, a.familia, af.billing_company_id::text
FROM invoice_items ii
JOIN invoices i ON i.id = ii.invoice_id
JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
LEFT JOIN articles a ON a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND upper(btrim(a.descripcion)) = upper(btrim(ii.description))
LEFT JOIN article_families af ON af.company_id = a.company_id AND af.name = a.familia
WHERE m.company_id = dunasoft.style_sync_hub_company_id()
  AND m.style_key LIKE '2026/%'
  AND i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
  AND upper(ii.description) LIKE '%NEUROMOD%'
LIMIT 10;

SELECT count(*) FILTER (WHERE af.billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d') AS med,
       count(*) FILTER (WHERE af.billing_company_id IS DISTINCT FROM '816af484-92a0-4f65-a5a7-1c907aa4bb3d') AS other
FROM invoice_items ii
JOIN invoices i ON i.id = ii.invoice_id
JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
LEFT JOIN articles a ON a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND upper(btrim(a.descripcion)) = upper(btrim(ii.description))
LEFT JOIN article_families af ON af.company_id = a.company_id AND af.name = a.familia
WHERE m.company_id = dunasoft.style_sync_hub_company_id()
  AND m.style_key LIKE '2026/%'
  AND i.issue_date >= '2026-01-01';
