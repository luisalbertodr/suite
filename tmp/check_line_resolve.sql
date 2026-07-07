SELECT ii.description, ii.total_price,
  public.resolve_line_billing_company_id(ii.description, '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid) AS billing
FROM public.invoices i
JOIN public.invoice_items ii ON ii.invoice_id = i.id
INNER JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
WHERE m.company_id = dunasoft.style_sync_hub_company_id()
  AND m.style_key LIKE '2026/%'
  AND i.issue_date >= '2026-05-01' AND i.issue_date < '2026-06-01'
ORDER BY ii.total_price DESC
LIMIT 25;

SELECT count(*) FILTER (WHERE billing = '816af484-92a0-4f65-a5a7-1c907aa4bb3d') AS med,
       count(*) FILTER (WHERE billing = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4') AS est
FROM (
  SELECT public.resolve_line_billing_company_id(ii.description, '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid) AS billing
  FROM public.invoices i
  JOIN public.invoice_items ii ON ii.invoice_id = i.id
  INNER JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  WHERE m.company_id = dunasoft.style_sync_hub_company_id()
    AND m.style_key LIKE '2026/5%'
) s;
