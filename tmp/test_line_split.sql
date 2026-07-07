WITH hub AS (
  SELECT dunasoft.style_sync_hub_company_id() AS id,
         '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid AS med_bill
),
lines AS (
  SELECT
    extract(month FROM i.issue_date)::int AS month_num,
    ii.total_price,
    COALESCE(
      (
        SELECT COALESCE(a.billing_company_id, af.billing_company_id, hub.id)
        FROM public.articles a
        LEFT JOIN public.article_families af
          ON af.company_id = a.company_id AND af.name = a.familia
        CROSS JOIN hub
        WHERE a.company_id = hub.id
          AND upper(btrim(a.descripcion)) = upper(btrim(ii.description))
        ORDER BY
          CASE WHEN COALESCE(a.billing_company_id, af.billing_company_id) = hub.med_bill THEN 0 ELSE 1 END,
          a.updated_at DESC NULLS LAST
        LIMIT 1
      ),
      public.resolve_line_billing_company_id(ii.description, (SELECT id FROM hub))
    ) AS billing_id
  FROM public.invoices i
  JOIN public.invoice_items ii ON ii.invoice_id = i.id
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
)
SELECT month_num,
  round(sum(total_price) FILTER (WHERE billing_id = (SELECT med_bill FROM hub))::numeric, 2) AS medicina,
  round(sum(total_price) FILTER (WHERE billing_id <> (SELECT med_bill FROM hub))::numeric, 2) AS estetica
FROM lines
GROUP BY 1
ORDER BY 1;
