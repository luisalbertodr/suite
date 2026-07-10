WITH active_invoices AS (
  SELECT
    i.id,
    i.total_amount,
    i.customer_id,
    i.issue_date,
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
with_faclin AS (
  SELECT ai.id,
    sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0)) AS faclin_amt
  FROM active_invoices ai
  JOIN legacy.faclin fl
    ON btrim(fl.ejefac) = ai.ejefac AND btrim(fl.serfac) = ai.serfac AND btrim(fl.numfac) = ai.numfac
  GROUP BY ai.id
),
with_appt AS (
  SELECT DISTINCT ON (ai.id)
    ai.id,
    coalesce(nullif(btrim(aa.legacy_codemp), ''), nullif(btrim(ae.dunasoft_codemp), '')) AS codemp
  FROM active_invoices ai
  LEFT JOIN public.agenda_appointments aa
    ON aa.customer_id = ai.customer_id AND aa.appointment_date = ai.issue_date
  LEFT JOIN public.agenda_employees ae ON ae.id::text = aa.employee_id
  WHERE coalesce(nullif(btrim(aa.legacy_codemp), ''), nullif(btrim(ae.dunasoft_codemp), '')) IS NOT NULL
  ORDER BY ai.id, aa.start_time NULLS LAST
)
SELECT
  count(*) AS total_invoices,
  count(*) FILTER (WHERE wf.id IS NOT NULL) AS with_faclin,
  count(*) FILTER (WHERE wa.id IS NOT NULL) AS with_appt
FROM active_invoices ai
LEFT JOIN with_faclin wf ON wf.id = ai.id AND wf.faclin_amt > 0
LEFT JOIN with_appt wa ON wa.id = ai.id;

-- Combined employee sales strategy
WITH active_invoices AS (
  SELECT i.id, i.total_amount, i.customer_id, i.issue_date,
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
    AND e.style_key IS NULL AND m.style_key LIKE '2026/%'
),
line_sales AS (
  SELECT ai.id AS invoice_id, coalesce(nullif(btrim(fl.codemp),''), nullif(btrim(fl.codemp2),''), '') AS codemp,
    sum(coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0)) AS amount
  FROM active_invoices ai
  JOIN legacy.faclin fl ON btrim(fl.ejefac)=ai.ejefac AND btrim(fl.serfac)=ai.serfac AND btrim(fl.numfac)=ai.numfac
  GROUP BY 1,2
),
invoices_with_lines AS (SELECT DISTINCT invoice_id FROM line_sales WHERE amount > 0),
fallback_sales AS (
  SELECT ai.id AS invoice_id,
    coalesce(nullif(btrim(aa.legacy_codemp),''), nullif(btrim(ae.dunasoft_codemp),''), '') AS codemp,
    ai.total_amount AS amount
  FROM active_invoices ai
  LEFT JOIN invoices_with_lines iwl ON iwl.invoice_id = ai.id
  LEFT JOIN LATERAL (
    SELECT aa2.legacy_codemp, aa2.employee_id
    FROM public.agenda_appointments aa2
    WHERE aa2.customer_id = ai.customer_id AND aa2.appointment_date = ai.issue_date
    ORDER BY aa2.start_time NULLS LAST LIMIT 1
  ) aa ON true
  LEFT JOIN public.agenda_employees ae ON ae.id::text = aa.employee_id
  WHERE iwl.invoice_id IS NULL
),
all_sales AS (
  SELECT * FROM line_sales WHERE amount > 0
  UNION ALL
  SELECT * FROM fallback_sales WHERE amount > 0
)
SELECT
  coalesce(ae.name, CASE WHEN nullif(btrim(s.codemp),'') IS NULL THEN 'Sin asignar' ELSE 'Empleada '||btrim(s.codemp) END) AS name,
  count(DISTINCT s.invoice_id) AS tickets,
  round(sum(s.amount)::numeric,2) AS amount
FROM all_sales s
LEFT JOIN public.agenda_employees ae ON ae.company_id = dunasoft.style_sync_hub_company_id()
  AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp,'')),'0'),''),'0')
    = coalesce(nullif(ltrim(btrim(coalesce(s.codemp,'')),'0'),''),'0')
GROUP BY 1, s.codemp
ORDER BY amount DESC;
