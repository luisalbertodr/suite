-- Compare invoice company_id split vs line-level billing split (2026)
WITH hub AS (
  SELECT dunasoft.style_sync_hub_company_id() AS id
),
style_invoices AS (
  SELECT i.id, i.issue_date, i.company_id, i.total_amount
  FROM public.invoices i
  INNER JOIN dunasoft.style_sync_entity_map m
    ON m.suite_id = i.id AND m.entity_type = 'invoice'
  LEFT JOIN dunasoft.style_sync_billing_exclusions e
    ON e.company_id = m.company_id AND e.style_key = m.style_key
  CROSS JOIN hub
  WHERE extract(year FROM i.issue_date) = 2026
    AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
    AND e.style_key IS NULL
    AND m.company_id = hub.id
    AND m.style_key LIKE '2026/%'
),
line_split AS (
  SELECT
    extract(month FROM si.issue_date)::int AS month_num,
    round(sum(ii.total_price) FILTER (
      WHERE public.resolve_line_billing_company_id(ii.description, (SELECT id FROM hub))
        = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
    )::numeric, 2) AS med_lines,
    round(sum(ii.total_price) FILTER (
      WHERE public.resolve_line_billing_company_id(ii.description, (SELECT id FROM hub))
        <> '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
    )::numeric, 2) AS est_lines
  FROM style_invoices si
  JOIN public.invoice_items ii ON ii.invoice_id = si.id
  GROUP BY 1
),
inv_split AS (
  SELECT
    extract(month FROM issue_date)::int AS month_num,
    round(sum(total_amount) FILTER (WHERE company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d')::numeric, 2) AS inv_816,
    round(sum(total_amount) FILTER (WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4')::numeric, 2) AS inv_5d7
  FROM style_invoices
  GROUP BY 1
)
SELECT l.month_num, l.med_lines, l.est_lines, i.inv_816, i.inv_5d7
FROM line_split l
JOIN inv_split i ON i.month_num = l.month_num
ORDER BY 1;
