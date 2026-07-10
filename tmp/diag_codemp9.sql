SELECT fc.ejefac, fc.serfac, fc.numfac, fc.codcli, fc.codemp, fc.totfac, fc.fecfac
FROM legacy.faccab fc
WHERE fc.ejefac='2026' AND fc.serfac='A' AND fc.numfac IN ('1448','1449','1473')
ORDER BY fc.numfac, fc.codcli;

SELECT fl.ejefac, fl.serfac, fl.numfac, fl.codemp, fl.subtot, count(*)
FROM legacy.faclin fl
WHERE fl.ejefac='2026' AND fl.serfac='A' AND fl.numfac IN ('1448','1449','1473')
GROUP BY 1,2,3,4,5;

-- check style billing ledger
SELECT * FROM dunasoft.style_billing_incremental_ledger
WHERE style_key LIKE '2026/A/1448%'
LIMIT 5;

-- invoice_items with variation -> employee? appointment link?
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='sales';

SELECT i.number, ii.description, ii.total_price, av.id
FROM public.invoices i
JOIN public.invoice_items ii ON ii.invoice_id=i.id
LEFT JOIN public.article_variations av ON av.id=ii.variation_id
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
LIMIT 5;

-- agenda appointments linked to invoice?
SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='agenda_appointments'
  AND column_name ILIKE '%invoice%';
