SELECT fc.codemp, fc.serfac, fc.numfac, fc.codcli, fc.totfac, fc.fecfac
FROM legacy.faccab fc
WHERE fc.numfac IN ('1448','1449','1439','1467')
ORDER BY fc.fecfac;

-- faclin codemp per invoice
SELECT fl.serfac, fl.numfac, fl.codemp, count(*), sum(coalesce(fl.importe::numeric,0))
FROM legacy.faclin fl
WHERE fl.numfac IN ('1448','1449','1439')
GROUP BY 1,2,3;

-- aggregate sales by faccab codemp for july via style map (fix join - codcli padding?)
SELECT
  fc.codemp,
  coalesce(ae.name, 'Empleada ' || coalesce(nullif(btrim(fc.codemp),''), '?')) AS name,
  count(DISTINCT i.id) AS tickets,
  round(sum(i.total_amount)::numeric, 2) AS amount
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
JOIN legacy.faccab fc
  ON btrim(fc.serfac) = btrim(split_part(m.style_key,'/',2))
 AND btrim(fc.numfac) = btrim(split_part(m.style_key,'/',3))
 AND ltrim(btrim(fc.codcli), '0') = ltrim(btrim(split_part(m.style_key,'/',4)), '0')
LEFT JOIN public.agenda_employees ae ON ae.company_id = dunasoft.style_sync_hub_company_id()
  AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0')
    = coalesce(nullif(ltrim(btrim(coalesce(fc.codemp, '')), '0'), ''), '0')
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
  AND m.company_id = dunasoft.style_sync_hub_company_id()
  AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
GROUP BY 1, 2
ORDER BY amount DESC;

-- faclin fallback if faccab.codemp empty
SELECT
  fl.codemp,
  coalesce(ae.name, 'Empleada ' || coalesce(nullif(btrim(fl.codemp),''), '?')) AS name,
  count(DISTINCT i.id) AS tickets,
  round(sum(DISTINCT i.total_amount)::numeric, 2) AS amount_wrong
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
JOIN legacy.faclin fl
  ON btrim(fl.serfac) = btrim(split_part(m.style_key,'/',2))
 AND btrim(fl.numfac) = btrim(split_part(m.style_key,'/',3))
LEFT JOIN public.agenda_employees ae ON ae.company_id = dunasoft.style_sync_hub_company_id()
  AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0')
    = coalesce(nullif(ltrim(btrim(coalesce(fl.codemp, '')), '0'), ''), '0')
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
  AND m.company_id = dunasoft.style_sync_hub_company_id()
GROUP BY 1,2
ORDER BY 2
LIMIT 20;
