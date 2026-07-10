SELECT column_name FROM information_schema.columns
WHERE table_schema='legacy' AND table_name='faccab'
  AND column_name ILIKE '%emp%';

SELECT column_name FROM information_schema.columns
WHERE table_schema='public' AND table_name='invoices'
ORDER BY ordinal_position;

-- faccab jul 2026 sample
SELECT codemp, serfac, numfac, totfac
FROM legacy.faccab
WHERE public.legacy_text_to_date(fecfac) BETWEEN '2026-07-01' AND '2026-07-10'
LIMIT 10;

-- join faccab to suite invoice via style map
SELECT
  split_part(m.style_key,'/',3) AS numfac,
  fc.codemp,
  ae.name,
  i.total_amount
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
LEFT JOIN legacy.faccab fc ON fc.serfac = split_part(m.style_key,'/',2)
  AND fc.numfac = split_part(m.style_key,'/',3)
  AND fc.codcli = split_part(m.style_key,'/',4)
LEFT JOIN public.agenda_employees ae ON ae.company_id = dunasoft.style_sync_hub_company_id()
  AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0')
    = coalesce(nullif(ltrim(btrim(coalesce(fc.codemp, '')), '0'), ''), '0')
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
  AND m.company_id = dunasoft.style_sync_hub_company_id()
LIMIT 15;

-- sales by employee via faccab
SELECT
  coalesce(ae.name, 'Empleada ' || coalesce(fc.codemp, '?')) AS name,
  fc.codemp,
  count(*) AS tickets,
  round(sum(i.total_amount)::numeric, 2) AS amount
FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
LEFT JOIN legacy.faccab fc ON fc.serfac = split_part(m.style_key,'/',2)
  AND fc.numfac = split_part(m.style_key,'/',3)
  AND fc.codcli = split_part(m.style_key,'/',4)
LEFT JOIN public.agenda_employees ae ON ae.company_id = dunasoft.style_sync_hub_company_id()
  AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0')
    = coalesce(nullif(ltrim(btrim(coalesce(fc.codemp, '')), '0'), ''), '0')
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
  AND m.company_id = dunasoft.style_sync_hub_company_id()
  AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
GROUP BY 1, 2
ORDER BY amount DESC;
