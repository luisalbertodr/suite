WITH active_invoices AS (
  SELECT
    i.id,
    i.total_amount,
    i.issue_date,
    btrim(split_part(m.style_key, '/', 1)) AS ejefac,
    btrim(split_part(m.style_key, '/', 2)) AS serfac,
    btrim(split_part(m.style_key, '/', 3)) AS numfac,
    btrim(split_part(m.style_key, '/', 4)) AS codcli
  FROM public.invoices i
  JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
  LEFT JOIN dunasoft.style_sync_billing_exclusions e ON e.company_id = m.company_id AND e.style_key = m.style_key
  WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
    AND m.company_id = dunasoft.style_sync_hub_company_id()
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND e.style_key IS NULL
    AND m.style_key LIKE '2026/%'
),
faclin_lines AS (
  SELECT ai.id AS invoice_id,
    coalesce(nullif(btrim(fl.codemp::text), ''), nullif(btrim(fl.codemp2::text), ''), '') AS codemp,
    sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0)) AS amount
  FROM active_invoices ai
  JOIN dunasoft.faclin fl
    ON btrim(fl.ejefac::text) = ai.ejefac
   AND btrim(fl.serfac::text) = ai.serfac
   AND btrim(fl.numfac::text) = ai.numfac
  JOIN dunasoft.faccab fc
    ON btrim(fc.ejefac::text) = ai.ejefac
   AND btrim(fc.serfac::text) = ai.serfac
   AND btrim(fc.numfac::text) = ai.numfac
   AND ltrim(btrim(fc.codcli::text), '0') = ltrim(btrim(ai.codcli), '0')
  GROUP BY 1, 2
  UNION ALL
  SELECT ai.id,
    coalesce(nullif(btrim(fl.codemp::text), ''), nullif(btrim(fl.codemp2::text), ''), '') AS codemp,
    sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0)) AS amount
  FROM active_invoices ai
  JOIN legacy.faclin fl
    ON btrim(fl.ejefac::text) = ai.ejefac
   AND btrim(fl.serfac::text) = ai.serfac
   AND btrim(fl.numfac::text) = ai.numfac
  JOIN legacy.faccab fc
    ON btrim(fc.ejefac::text) = ai.ejefac
   AND btrim(fc.serfac::text) = ai.serfac
   AND btrim(fc.numfac::text) = ai.numfac
   AND ltrim(btrim(fc.codcli::text), '0') = ltrim(btrim(ai.codcli), '0')
  GROUP BY 1, 2
),
invoices_with_faclin AS (
  SELECT invoice_id, sum(amount) AS faclin_total
  FROM faclin_lines
  GROUP BY 1
),
plan_lines AS (
  SELECT
    ai.id AS invoice_id,
    coalesce(nullif(btrim(p.codemp::text), ''), '') AS codemp,
    ai.total_amount / greatest(count(*) OVER (PARTITION BY ai.id), 1) AS amount
  FROM active_invoices ai
  LEFT JOIN invoices_with_faclin iwl ON iwl.invoice_id = ai.id
  JOIN dunasoft.plan2009 p
    ON p.fecha = ai.issue_date
   AND ltrim(btrim(p.codcli::text), '0') = ltrim(btrim(ai.codcli), '0')
   AND p.facturado
  WHERE coalesce(iwl.faclin_total, 0) = 0
),
all_lines AS (
  SELECT invoice_id, codemp, amount FROM faclin_lines WHERE amount > 0
  UNION ALL
  SELECT invoice_id, codemp, amount FROM plan_lines WHERE amount > 0
)
SELECT
  coalesce(
    ae.name,
    CASE WHEN nullif(btrim(al.codemp), '') IS NULL THEN 'Sin asignar' ELSE 'Empleada ' || btrim(al.codemp) END
  ) AS name,
  count(DISTINCT al.invoice_id) AS tickets,
  round(sum(al.amount)::numeric, 2) AS amount
FROM all_lines al
LEFT JOIN public.agenda_employees ae
  ON ae.company_id = dunasoft.style_sync_hub_company_id()
 AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0')
   = coalesce(nullif(ltrim(btrim(coalesce(al.codemp, '')), '0'), ''), '0')
GROUP BY 1, al.codemp
ORDER BY amount DESC;

SELECT round(sum(total_amount)::numeric,2) FROM active_invoices;
