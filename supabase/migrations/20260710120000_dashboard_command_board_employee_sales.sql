-- Cuadro de mandos: ventas por empleada (faclin + plan2009), sin topEmployee erróneo.

CREATE OR REPLACE FUNCTION public.dashboard_command_board_stats(
  p_company_id uuid,
  p_catalog_company_id uuid,
  p_from_date date,
  p_to_date date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft, legacy
SET statement_timeout = '120s'
AS $$
DECLARE
  v_hub uuid := dunasoft.style_sync_hub_company_id();
  v_use_style boolean;
  v_year int := extract(year FROM p_from_date)::int;
  v_result jsonb;
BEGIN
  IF p_from_date IS NULL OR p_to_date IS NULL OR p_from_date > p_to_date THEN
    RAISE EXCEPTION 'Rango de fechas inválido';
  END IF;

  PERFORM public.assert_catalog_company_access(p_catalog_company_id);

  v_use_style := p_company_id = v_hub OR EXISTS (
    SELECT 1
    FROM public.companies c
    JOIN public.companies h ON h.id = v_hub
    WHERE c.id = p_company_id
      AND c.work_center_id IS NOT NULL
      AND c.work_center_id = h.work_center_id
  );

  WITH active_invoices AS (
    SELECT
      i.id,
      i.customer_id,
      i.total_amount,
      i.amount_paid,
      i.number,
      i.issue_date,
      coalesce(
        nullif(split_part(m.style_key, '/', 2), ''),
        CASE WHEN i.number LIKE '00-%' THEN '00' ELSE 'A' END
      ) AS serfac,
      nullif(btrim(split_part(m.style_key, '/', 1)), '') AS ejefac,
      nullif(btrim(split_part(m.style_key, '/', 3)), '') AS style_numfac,
      nullif(btrim(split_part(m.style_key, '/', 4)), '') AS style_codcli,
      m.style_key
    FROM public.invoices i
    LEFT JOIN dunasoft.style_sync_entity_map m
      ON m.suite_id = i.id
     AND m.entity_type = 'invoice'
    LEFT JOIN dunasoft.style_sync_billing_exclusions e
      ON e.company_id = m.company_id
     AND e.style_key = m.style_key
    WHERE i.issue_date BETWEEN p_from_date AND p_to_date
      AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
      AND e.style_key IS NULL
      AND (
        (v_use_style AND m.company_id = v_hub AND m.style_key LIKE v_year::text || '/%')
        OR (NOT v_use_style AND i.company_id = p_company_id)
        OR (m.suite_id IS NULL AND i.company_id = p_company_id)
      )
      AND NOT (
        i.number ~ '^A-[0-9]+$'
        AND m.style_key IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM public.invoices i2
          INNER JOIN dunasoft.style_sync_entity_map m2
            ON m2.suite_id = i2.id
           AND m2.entity_type = 'invoice'
          WHERE m2.company_id = v_hub
            AND m2.style_key LIKE v_year::text || '/A/'
              || split_part(m.style_key, '/', 3) || '/'
              || split_part(m.style_key, '/', 4) || '/%'
            AND i2.number ~ ('^A-' || v_year::text || '-[0-9]+$')
            AND lower(coalesce(i2.status, '')) NOT IN ('cancelled', 'void', 'anulada')
        )
      )
  ),
  bono_sales AS (
    SELECT b.id, b.precio_total AS amount, b.customer_id, b.nombre AS label
    FROM public.bonos b
    WHERE b.company_id = p_company_id
      AND b.fecha_compra BETWEEN p_from_date AND p_to_date
    UNION ALL
    SELECT
      cv.id,
      cv.paid_amount AS amount,
      cv.customer_id,
      coalesce(nullif(btrim(a.descripcion), ''), nullif(btrim(a.codigo), ''), 'Bono') AS label
    FROM public.customer_vouchers cv
    LEFT JOIN public.articles a ON a.id = cv.article_id
    WHERE cv.company_id = p_company_id
      AND cv.purchase_date BETWEEN p_from_date AND p_to_date
  ),
  invoice_serfac AS (
    SELECT
      ai.*,
      CASE WHEN ai.serfac = '00' THEN 'bonos' ELSE 'other' END AS bucket
    FROM active_invoices ai
  ),
  ticket_stats AS (
    SELECT
      count(*)::bigint AS tickets_total,
      count(*) FILTER (WHERE bucket = 'bonos')::bigint AS tickets_bonos,
      count(*) FILTER (WHERE bucket = 'other')::bigint AS tickets_other,
      round(coalesce(sum(total_amount), 0)::numeric, 2) AS invoiced_total,
      round(coalesce(sum(total_amount) FILTER (WHERE bucket = 'bonos'), 0)::numeric, 2) AS invoiced_bonos,
      round(coalesce(sum(total_amount) FILTER (WHERE bucket = 'other'), 0)::numeric, 2) AS invoiced_other,
      round(coalesce(sum(greatest(total_amount - coalesce(amount_paid, 0), 0)), 0)::numeric, 2) AS debts_total
    FROM invoice_serfac
  ),
  bono_stats AS (
    SELECT
      count(*)::bigint AS extra_tickets,
      round(coalesce(sum(amount), 0)::numeric, 2) AS extra_amount
    FROM bono_sales bs
    WHERE NOT EXISTS (
      SELECT 1 FROM active_invoices ai WHERE ai.serfac = '00'
    )
  ),
  line_items_typed AS (
    SELECT
      ii.total_price,
      lower(coalesce(
        av_art.tipo_producto,
        parsed.tipo_producto,
        'servicio'
      )) AS tipo_producto
    FROM public.invoice_items ii
    INNER JOIN active_invoices ai ON ai.id = ii.invoice_id
    LEFT JOIN public.article_variations av ON av.id = ii.variation_id
    LEFT JOIN public.articles av_art ON av_art.id = av.article_id
    LEFT JOIN LATERAL (
      SELECT ar.tipo_producto
      FROM public.articles ar
      WHERE ar.company_id = p_catalog_company_id
        AND (
          upper(btrim(ar.codigo)) = upper(btrim(substring(ii.description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*')))
          OR upper(btrim(ar.descripcion)) = upper(btrim(ii.description))
        )
      ORDER BY ar.updated_at DESC NULLS LAST
      LIMIT 1
    ) parsed ON ii.variation_id IS NULL
  ),
  line_stats AS (
    SELECT
      round(coalesce(sum(total_price) FILTER (
        WHERE tipo_producto IN ('servicio', 'service')
      ), 0)::numeric, 2) AS services_amount,
      count(*) FILTER (
        WHERE tipo_producto IN ('servicio', 'service')
      )::bigint AS services_count,
      round(coalesce(sum(total_price) FILTER (
        WHERE tipo_producto IN ('producto', 'product', 'textil', 'calzado', 'standard')
      ), 0)::numeric, 2) AS products_amount,
      count(*) FILTER (
        WHERE tipo_producto IN ('producto', 'product', 'textil', 'calzado', 'standard')
      )::bigint AS products_count
    FROM line_items_typed
  ),
  faclin_amount AS (
    SELECT
      btrim(fl.ejefac::text) AS ejefac,
      btrim(fl.serfac::text) AS serfac,
      btrim(fl.numfac::text) AS numfac,
      btrim(fc.codcli::text) AS codcli,
      coalesce(nullif(btrim(fl.codemp::text), ''), nullif(btrim(fl.codemp2::text), ''), '') AS codemp,
      coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0) AS amount
    FROM dunasoft.faclin fl
    INNER JOIN dunasoft.faccab fc
      ON btrim(fc.ejefac::text) = btrim(fl.ejefac::text)
     AND btrim(fc.serfac::text) = btrim(fl.serfac::text)
     AND btrim(fc.numfac::text) = btrim(fl.numfac::text)
    UNION ALL
    SELECT
      btrim(fl.ejefac::text),
      btrim(fl.serfac::text),
      btrim(fl.numfac::text),
      btrim(fc.codcli::text),
      coalesce(nullif(btrim(fl.codemp::text), ''), nullif(btrim(fl.codemp2::text), ''), ''),
      coalesce(nullif(regexp_replace(btrim(fl.subtot::text), ',', '.', 'g'), '')::numeric, 0)
    FROM legacy.faclin fl
    INNER JOIN legacy.faccab fc
      ON btrim(fc.ejefac::text) = btrim(fl.ejefac::text)
     AND btrim(fc.serfac::text) = btrim(fl.serfac::text)
     AND btrim(fc.numfac::text) = btrim(fl.numfac::text)
  ),
  faclin_sales AS (
    SELECT
      ai.id AS invoice_id,
      fa.codemp,
      sum(fa.amount) AS amount
    FROM active_invoices ai
    INNER JOIN faclin_amount fa
      ON ai.ejefac IS NOT NULL
     AND ai.style_numfac IS NOT NULL
     AND ai.style_codcli IS NOT NULL
     AND fa.ejefac = ai.ejefac
     AND fa.serfac = ai.serfac
     AND fa.numfac = ai.style_numfac
     AND ltrim(btrim(fa.codcli), '0') = ltrim(btrim(ai.style_codcli), '0')
    GROUP BY ai.id, fa.codemp
  ),
  invoices_with_faclin AS (
    SELECT invoice_id, sum(amount) AS faclin_total
    FROM faclin_sales
    GROUP BY invoice_id
  ),
  plan_sales AS (
    SELECT
      ai.id AS invoice_id,
      coalesce(nullif(btrim(p.codemp::text), ''), '') AS codemp,
      ai.total_amount / greatest(count(*) OVER (PARTITION BY ai.id), 1)::numeric AS amount
    FROM active_invoices ai
    LEFT JOIN invoices_with_faclin iw ON iw.invoice_id = ai.id
    INNER JOIN dunasoft.plan2009 p
      ON p.fecha = ai.issue_date
     AND ltrim(btrim(p.codcli::text), '0') = ltrim(btrim(ai.style_codcli), '0')
     AND p.facturado
    WHERE v_use_style
      AND ai.style_codcli IS NOT NULL
      AND coalesce(iw.faclin_total, 0) = 0
  ),
  employee_sales_lines AS (
    SELECT invoice_id, codemp, amount FROM faclin_sales WHERE amount > 0
    UNION ALL
    SELECT invoice_id, codemp, amount FROM plan_sales WHERE amount > 0
    UNION ALL
    SELECT ai.id, '' AS codemp, ai.total_amount AS amount
    FROM active_invoices ai
    WHERE NOT EXISTS (SELECT 1 FROM faclin_sales fs WHERE fs.invoice_id = ai.id)
      AND NOT EXISTS (SELECT 1 FROM plan_sales ps WHERE ps.invoice_id = ai.id)
  ),
  employee_sales_rows AS (
    SELECT
      CASE
        WHEN nullif(btrim(es.codemp), '') IS NULL THEN 'Sin asignar'
        ELSE coalesce(ae.name, 'Empleada ' || btrim(es.codemp))
      END AS name,
      count(DISTINCT es.invoice_id)::bigint AS tickets,
      round(sum(es.amount)::numeric, 2) AS amount
    FROM employee_sales_lines es
    LEFT JOIN public.agenda_employees ae
      ON ae.company_id = p_company_id
     AND nullif(btrim(es.codemp), '') IS NOT NULL
     AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0')
       = coalesce(nullif(ltrim(btrim(coalesce(es.codemp, '')), '0'), ''), '0')
    GROUP BY 1
  ),
  employee_sales_json AS (
    SELECT coalesce(
      jsonb_agg(
        jsonb_build_object('name', name, 'amount', amount, 'tickets', tickets)
        ORDER BY amount DESC, name
      ),
      '[]'::jsonb
    ) AS data
    FROM employee_sales_rows
  ),
  top_article AS (
    SELECT
      coalesce(nullif(btrim(ii.description), ''), 'Sin descripción') AS name,
      round(sum(ii.total_price)::numeric, 2) AS amount
    FROM public.invoice_items ii
    INNER JOIN active_invoices ai ON ai.id = ii.invoice_id
    GROUP BY 1
    ORDER BY amount DESC
    LIMIT 1
  ),
  top_bono AS (
    SELECT label AS name, round(sum(amount)::numeric, 2) AS amount
    FROM bono_sales
    GROUP BY 1
    ORDER BY amount DESC
    LIMIT 1
  ),
  top_customer AS (
    SELECT
      coalesce(c.name, 'Cliente') AS name,
      round(sum(ai.total_amount)::numeric, 2) AS amount
    FROM invoice_serfac ai
    INNER JOIN public.customers c ON c.id = ai.customer_id
    GROUP BY 1
    ORDER BY amount DESC
    LIMIT 1
  ),
  new_clients AS (
    SELECT
      count(*)::bigint AS total,
      count(*) FILTER (WHERE upper(coalesce(lc.sexo, 'M')) = 'M')::bigint AS women,
      count(*) FILTER (WHERE upper(coalesce(lc.sexo, '')) = 'H')::bigint AS men,
      count(*) FILTER (WHERE upper(coalesce(lc.sexo, '')) = 'N')::bigint AS children
    FROM public.customers c
    LEFT JOIN legacy.clientes lc
      ON public.legacy_codcli_to_bigint(lc.codcli) = public.legacy_codcli_to_bigint(c.legacy_codcli)
    WHERE c.company_id = p_catalog_company_id
      AND (
        (
          public.legacy_text_to_date(lc.fecalta) IS NOT NULL
          AND public.legacy_text_to_date(lc.fecalta) BETWEEN p_from_date AND p_to_date
        )
        OR (
          public.legacy_text_to_date(lc.fecalta) IS NULL
          AND c.created_at::date BETWEEN p_from_date AND p_to_date
        )
      )
  ),
  period_clients AS (
    SELECT count(DISTINCT ai.customer_id)::bigint AS total
    FROM invoice_serfac ai
    WHERE ai.customer_id IS NOT NULL
  ),
  total_clients AS (
    SELECT count(*)::bigint AS total
    FROM public.customers c
    WHERE c.company_id = p_catalog_company_id
  ),
  reservations AS (
    SELECT
      count(*)::bigint AS scheduled,
      round((coalesce(sum(dunasoft.plan_slot_minutes(p.horini, p.horfin)), 0) / 60.0)::numeric, 2) AS scheduled_hours,
      count(*) FILTER (WHERE p.facturado)::bigint AS billed,
      round((coalesce(sum(dunasoft.plan_slot_minutes(p.horini, p.horfin)) FILTER (WHERE p.facturado), 0) / 60.0)::numeric, 2) AS billed_hours
    FROM dunasoft.plan2009 p
    WHERE p.fecha BETWEEN p_from_date AND p_to_date
  ),
  cash_legacy AS (
    SELECT
      round(coalesce(sum(
        NULLIF(regexp_replace(btrim(ce.impdoc), ',', '.', 'g'), '')::numeric
      ) FILTER (WHERE upper(btrim(ce.tipdoc)) IN ('E', 'A')), 0)::numeric, 2) AS cash_in,
      round(coalesce(sum(
        NULLIF(regexp_replace(btrim(ce.impdoc), ',', '.', 'g'), '')::numeric
      ) FILTER (WHERE upper(btrim(ce.tipdoc)) = 'S'), 0)::numeric, 2) AS cash_out
    FROM legacy.cieentsal ce
    WHERE public.legacy_text_to_date(ce.fecdoc) BETWEEN p_from_date AND p_to_date
  ),
  cash_suite AS (
    SELECT
      round(coalesce(sum(m.amount) FILTER (WHERE m.movement_type = 'cash_in'), 0)::numeric, 2) AS cash_in,
      round(coalesce(sum(m.amount) FILTER (WHERE m.movement_type = 'withdrawal'), 0)::numeric, 2) AS cash_out
    FROM public.cash_register_movements m
    INNER JOIN public.cash_register_sessions s ON s.id = m.session_id
    WHERE s.company_id = p_company_id
      AND s.session_date BETWEEN p_from_date AND p_to_date
  ),
  purchases AS (
    SELECT 0::numeric AS total, 0::numeric AS debts
  ),
  merged AS (
    SELECT
      ts.*,
      bs.extra_tickets,
      bs.extra_amount,
      ls.services_amount,
      ls.services_count,
      ls.products_amount,
      ls.products_count,
      esj.data AS employee_sales,
      ta.name AS top_article_name,
      ta.amount AS top_article_amount,
      tb.name AS top_bono_name,
      tb.amount AS top_bono_amount,
      tc.name AS top_customer_name,
      tc.amount AS top_customer_amount,
      nc.total AS new_clients_total,
      nc.women AS new_clients_women,
      nc.men AS new_clients_men,
      nc.children AS new_clients_children,
      pc.total AS period_clients,
      tcl.total AS all_clients,
      r.scheduled AS res_scheduled,
      r.scheduled_hours AS res_scheduled_hours,
      r.billed AS res_billed,
      r.billed_hours AS res_billed_hours,
      greatest(cl.cash_in, cs.cash_in) AS cash_in,
      greatest(cl.cash_out, cs.cash_out) AS cash_out,
      pu.total AS purchases_total,
      pu.debts AS purchases_debts
    FROM ticket_stats ts
    CROSS JOIN bono_stats bs
    CROSS JOIN line_stats ls
    CROSS JOIN employee_sales_json esj
    LEFT JOIN top_article ta ON true
    LEFT JOIN top_bono tb ON true
    LEFT JOIN top_customer tc ON true
    CROSS JOIN new_clients nc
    CROSS JOIN period_clients pc
    CROSS JOIN total_clients tcl
    CROSS JOIN reservations r
    CROSS JOIN cash_legacy cl
    CROSS JOIN cash_suite cs
    CROSS JOIN purchases pu
  )
  SELECT jsonb_build_object(
    'period', jsonb_build_object('from', p_from_date, 'to', p_to_date),
    'sales', jsonb_build_object(
      'tickets', jsonb_build_object(
        'total', m.tickets_total + m.extra_tickets,
        'bonos', m.tickets_bonos + CASE WHEN m.tickets_bonos = 0 THEN m.extra_tickets ELSE 0 END,
        'other', m.tickets_other
      ),
      'invoiced', jsonb_build_object(
        'total', m.invoiced_total + CASE WHEN m.invoiced_bonos = 0 THEN m.extra_amount ELSE 0 END,
        'bonos', m.invoiced_bonos + CASE WHEN m.invoiced_bonos = 0 THEN m.extra_amount ELSE 0 END,
        'other', m.invoiced_other
      ),
      'avgTicket', jsonb_build_object(
        'total', CASE WHEN (m.tickets_total + m.extra_tickets) > 0
          THEN round((m.invoiced_total + CASE WHEN m.invoiced_bonos = 0 THEN m.extra_amount ELSE 0 END) / (m.tickets_total + m.extra_tickets), 2)
          ELSE 0 END,
        'bonos', CASE WHEN (m.tickets_bonos + CASE WHEN m.tickets_bonos = 0 THEN m.extra_tickets ELSE 0 END) > 0
          THEN round((m.invoiced_bonos + CASE WHEN m.invoiced_bonos = 0 THEN m.extra_amount ELSE 0 END)
            / (m.tickets_bonos + CASE WHEN m.tickets_bonos = 0 THEN m.extra_tickets ELSE 0 END), 2)
          ELSE 0 END,
        'other', CASE WHEN m.tickets_other > 0 THEN round(m.invoiced_other / m.tickets_other, 2) ELSE 0 END
      ),
      'services', jsonb_build_object('amount', m.services_amount, 'count', m.services_count),
      'products', jsonb_build_object('amount', m.products_amount, 'count', m.products_count),
      'debts', m.debts_total,
      'employeeSales', m.employee_sales,
      'topArticle', jsonb_build_object('name', coalesce(m.top_article_name, '—'), 'amount', coalesce(m.top_article_amount, 0)),
      'topBono', jsonb_build_object('name', coalesce(m.top_bono_name, '—'), 'amount', coalesce(m.top_bono_amount, 0)),
      'topCustomer', jsonb_build_object('name', coalesce(m.top_customer_name, '—'), 'amount', coalesce(m.top_customer_amount, 0))
    ),
    'clients', jsonb_build_object(
      'new', jsonb_build_object(
        'total', m.new_clients_total,
        'women', m.new_clients_women,
        'men', m.new_clients_men,
        'children', m.new_clients_children
      ),
      'periodActive', m.period_clients,
      'total', m.all_clients
    ),
    'reservations', jsonb_build_object(
      'scheduled', m.res_scheduled,
      'scheduledHours', m.res_scheduled_hours,
      'billed', m.res_billed,
      'billedHours', m.res_billed_hours
    ),
    'cash', jsonb_build_object('in', m.cash_in, 'out', m.cash_out),
    'purchases', jsonb_build_object('total', m.purchases_total, 'debts', m.purchases_debts),
    'profit', jsonb_build_object(
      'net', round(m.invoiced_other - m.purchases_total, 2)
    )
  )
  INTO v_result
  FROM merged m;

  RETURN coalesce(v_result, '{}'::jsonb);
END;
$$;
