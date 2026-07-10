SELECT column_name FROM information_schema.columns
WHERE table_schema='legacy' AND table_name IN ('faccab','faclin')
  AND column_name IN ('ejefac','serfac','numfac','codcli','codemp','subtot');

-- correct join with ejefac + codcli
WITH active_invoices AS (
  SELECT i.id, m.style_key,
    btrim(split_part(m.style_key,'/',1)) AS ejefac,
    btrim(split_part(m.style_key,'/',2)) AS serfac,
    btrim(split_part(m.style_key,'/',3)) AS numfac,
    btrim(split_part(m.style_key,'/',4)) AS codcli
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  LEFT JOIN dunasoft.style_sync_billing_exclusions e ON e.company_id = m.company_id AND e.style_key = m.style_key
  WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
    AND m.company_id = dunasoft.style_sync_hub_company_id()
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND e.style_key IS NULL
    AND m.style_key LIKE '2026/%'
),
line_sales AS (
  SELECT
    ai.id AS invoice_id,
    coalesce(nullif(btrim(fl.codemp), ''), nullif(btrim(fl.codemp2), ''), '') AS codemp,
    sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0)) AS line_amount
  FROM active_invoices ai
  JOIN legacy.faclin fl
    ON btrim(fl.ejefac) = ai.ejefac
   AND btrim(fl.serfac) = ai.serfac
   AND btrim(fl.numfac) = ai.numfac
  JOIN legacy.faccab fc
    ON btrim(fc.ejefac) = ai.ejefac
   AND btrim(fc.serfac) = ai.serfac
   AND btrim(fc.numfac) = ai.numfac
   AND ltrim(btrim(fc.codcli), '0') = ltrim(btrim(ai.codcli), '0')
  GROUP BY 1, 2
)
SELECT
  coalesce(ae.name, CASE WHEN nullif(btrim(ls.codemp),'') IS NULL THEN 'Sin asignar' ELSE 'Empleada ' || btrim(ls.codemp) END) AS name,
  count(DISTINCT ls.invoice_id) AS tickets,
  round(sum(ls.line_amount)::numeric, 2) AS amount
FROM line_sales ls
LEFT JOIN public.agenda_employees ae ON ae.company_id = dunasoft.style_sync_hub_company_id()
  AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0')
    = coalesce(nullif(ltrim(btrim(coalesce(ls.codemp, '')), '0'), ''), '0')
GROUP BY 1, ls.codemp
ORDER BY amount DESC NULLS LAST;

SELECT round(sum(i.total_amount)::numeric,2) FROM public.invoices i
JOIN dunasoft.style_sync_entity_map m ON m.suite_id=i.id AND m.entity_type='invoice'
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
  AND m.company_id=dunasoft.style_sync_hub_company_id()
  AND m.style_key LIKE '2026/%';
