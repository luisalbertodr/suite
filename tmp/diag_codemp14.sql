SELECT ii.description, ii.total_price, ii.variation_id
FROM public.invoices i
JOIN public.invoice_items ii ON ii.invoice_id=i.id
WHERE i.number='A-2026-1448';

-- style cola recent faccab/faclin
SELECT table_name FROM information_schema.tables WHERE table_schema='dunasoft' ORDER BY 1;

SELECT count(*) FROM dunasoft.style_sync_cola WHERE tabla IN ('faccab','faclin') AND created_at > '2026-07-01';

-- check notes/metadata on invoice
SELECT id, number, notes FROM public.invoices WHERE number LIKE 'A-2026-%' AND issue_date>='2026-07-01' LIMIT 5;

-- Maybe codemp in ejefac style map key old format A/numfac/codcli - search entity map patterns
SELECT DISTINCT split_part(style_key,'/',1) AS p1, count(*)
FROM dunasoft.style_sync_entity_map
WHERE entity_type='invoice' AND company_id=dunasoft.style_sync_hub_company_id()
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
