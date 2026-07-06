-- Facturación multi-ejercicio: clave style con ejefac, lookup por año y fechas en UPDATE.

DROP FUNCTION IF EXISTS dunasoft.style_facturas_apply_from_style(
  uuid, text, text, text, text, date, numeric, numeric, numeric, bigint
);
DROP FUNCTION IF EXISTS dunasoft.style_facturas_apply_from_style(
  uuid, text, text, text, text, date, numeric, numeric, numeric, text, bigint
);

CREATE OR REPLACE FUNCTION dunasoft.style_facturas_apply_from_style(
  p_company_id uuid,
  p_accion     text,
  p_numfac     text,
  p_serie      text,
  p_codcli     text,
  p_fecha      date,
  p_baseimp    numeric,
  p_iva        numeric,
  p_total      numeric,
  p_lineas     text DEFAULT '[]',
  p_sync_version bigint DEFAULT 0,
  p_ejefac     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_accion text := upper(btrim(coalesce(p_accion, 'UPSERT')));
  v_numfac text := btrim(coalesce(p_numfac, ''));
  v_serie text := btrim(coalesce(p_serie, ''));
  v_codcli text := btrim(coalesce(p_codcli, ''));
  v_ejefac text := btrim(coalesce(p_ejefac, ''));
  v_fiscal_year int := coalesce(
    nullif(v_ejefac, '')::int,
    extract(year FROM coalesce(p_fecha, current_date))::int
  );
  v_scale numeric := dunasoft.style_price_scale(p_company_id);
  v_customer_id uuid;
  v_lines jsonb;
  v_line jsonb;
  v_billing uuid;
  v_bucket record;
  v_invoice_id uuid;
  v_key text;
  v_old_key text;
  v_number text;
  v_prefix text;
  v_subtotal numeric;
  v_tax numeric;
  v_total numeric;
  v_groups int := 0;
  v_invoice_ids jsonb := '[]'::jsonb;
BEGIN
  IF v_numfac = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'numfac vacío');
  END IF;

  IF dunasoft.style_invoice_sync_excluded(p_company_id, v_serie, v_numfac, v_codcli) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'factura excluida (errónea)');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  v_customer_id := dunasoft.style_map_suite_id(p_company_id, 'customer', v_codcli);
  IF v_customer_id IS NULL AND v_codcli NOT IN ('', '0') THEN
    SELECT c.id INTO v_customer_id
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND public.legacy_codcli_to_bigint(c.legacy_codcli) = public.legacy_codcli_to_bigint(v_codcli)
    LIMIT 1;
  END IF;

  IF v_accion IN ('DELETE', 'BAJA', 'BORRAR') THEN
    FOR v_invoice_id IN
      SELECT suite_id FROM dunasoft.style_sync_entity_map
      WHERE company_id = p_company_id AND entity_type = 'invoice'
        AND (
          style_key LIKE v_fiscal_year::text || '/' || v_serie || '/' || v_numfac || '/' || v_codcli || '%'
          OR style_key LIKE v_serie || '/' || v_numfac || '/' || v_codcli || '%'
        )
    LOOP
      UPDATE public.invoices SET status = 'cancelled', updated_at = now() WHERE id = v_invoice_id;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'accion', 'DELETE', 'numfac', v_numfac);
  END IF;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cliente no resuelto', 'codcli', v_codcli);
  END IF;

  v_lines := coalesce(NULLIF(btrim(coalesce(p_lineas, '')), '')::jsonb, '[]'::jsonb);

  CREATE TEMP TABLE IF NOT EXISTS tmp_style_inv_buckets (
    billing_company_id uuid PRIMARY KEY,
    subtotal numeric NOT NULL DEFAULT 0,
    tax numeric NOT NULL DEFAULT 0,
    total numeric NOT NULL DEFAULT 0
  ) ON COMMIT DROP;
  TRUNCATE tmp_style_inv_buckets;

  IF jsonb_typeof(v_lines) = 'array' AND jsonb_array_length(v_lines) > 0 THEN
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
      v_billing := dunasoft.style_resolve_billing_company_id(
        p_company_id, btrim(coalesce(v_line->>'codart', ''))
      );
      INSERT INTO tmp_style_inv_buckets (billing_company_id, subtotal, tax, total)
      VALUES (
        v_billing,
        coalesce((v_line->>'subtot')::numeric, 0) * v_scale,
        coalesce((v_line->>'iva')::numeric, 0) * v_scale,
        coalesce((v_line->>'total')::numeric, (v_line->>'subtot')::numeric, 0) * v_scale
      )
      ON CONFLICT (billing_company_id) DO UPDATE SET
        subtotal = tmp_style_inv_buckets.subtotal + EXCLUDED.subtotal,
        tax = tmp_style_inv_buckets.tax + EXCLUDED.tax,
        total = tmp_style_inv_buckets.total + EXCLUDED.total;
    END LOOP;
    SELECT count(*) INTO v_groups FROM tmp_style_inv_buckets;
  ELSE
    INSERT INTO tmp_style_inv_buckets (billing_company_id, subtotal, tax, total)
    VALUES (
      p_company_id,
      coalesce(p_baseimp, 0) * v_scale,
      coalesce(p_iva, 0) * v_scale,
      coalesce(p_total, 0) * v_scale
    );
    v_groups := 1;
  END IF;

  FOR v_bucket IN SELECT * FROM tmp_style_inv_buckets WHERE total <> 0 LOOP
    v_old_key := v_serie || '/' || v_numfac || '/' || v_codcli || '/' || v_bucket.billing_company_id::text;
    v_key := v_fiscal_year::text || '/' || v_old_key;

    SELECT tpv_ticket_prefix INTO v_prefix FROM public.companies WHERE id = v_bucket.billing_company_id;
    v_number := coalesce(nullif(v_serie, ''), 'A') || '-' || v_numfac;
    IF v_groups > 1 AND v_prefix IS NOT NULL THEN
      v_number := v_number || '-' || v_prefix;
    END IF;

    v_invoice_id := dunasoft.style_map_suite_id(p_company_id, 'invoice', v_key);
    IF v_invoice_id IS NULL THEN
      v_invoice_id := dunasoft.style_map_suite_id(p_company_id, 'invoice', v_old_key);
    END IF;
    IF v_invoice_id IS NULL THEN
      SELECT id INTO v_invoice_id FROM public.invoices
      WHERE company_id = v_bucket.billing_company_id
        AND number = v_number
        AND extract(year FROM issue_date) = v_fiscal_year
      LIMIT 1;
    END IF;

    IF v_invoice_id IS NULL THEN
      INSERT INTO public.invoices (
        id, company_id, customer_id, number, issue_date, due_date, status,
        subtotal, tax_amount, total_amount, notes
      ) VALUES (
        gen_random_uuid(), v_bucket.billing_company_id, v_customer_id, v_number,
        coalesce(p_fecha, make_date(v_fiscal_year, 1, 1)),
        coalesce(p_fecha, make_date(v_fiscal_year, 1, 1)),
        'paid', v_bucket.subtotal, v_bucket.tax, v_bucket.total,
        'Factura Style sync'
      )
      RETURNING id INTO v_invoice_id;
    ELSE
      UPDATE public.invoices SET
        customer_id = v_customer_id,
        issue_date = coalesce(p_fecha, issue_date),
        due_date = coalesce(p_fecha, due_date),
        subtotal = v_bucket.subtotal,
        tax_amount = v_bucket.tax,
        total_amount = v_bucket.total,
        status = CASE WHEN status = 'cancelled' THEN 'paid' ELSE status END,
        updated_at = now()
      WHERE id = v_invoice_id;
    END IF;

    IF jsonb_typeof(v_lines) = 'array' AND jsonb_array_length(v_lines) > 0 THEN
      DELETE FROM public.invoice_items WHERE invoice_id = v_invoice_id;
      FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
        v_billing := dunasoft.style_resolve_billing_company_id(
          p_company_id, btrim(coalesce(v_line->>'codart', ''))
        );
        IF v_billing <> v_bucket.billing_company_id THEN CONTINUE; END IF;
        INSERT INTO public.invoice_items (
          invoice_id, description, quantity, unit_price, total_price
        ) VALUES (
          v_invoice_id,
          coalesce(v_line->>'desart', v_line->>'codart', 'Línea'),
          coalesce((v_line->>'cantidad')::numeric, 1),
          coalesce((v_line->>'precio')::numeric, 0) * v_scale,
          coalesce((v_line->>'total')::numeric, (v_line->>'subtot')::numeric, 0) * v_scale
        );
      END LOOP;
    END IF;

    PERFORM dunasoft.style_map_upsert(p_company_id, 'invoice', v_key, v_invoice_id, p_sync_version, 'style_to_suite');
    v_invoice_ids := v_invoice_ids || jsonb_build_array(v_invoice_id);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'accion', 'UPSERT', 'numfac', v_numfac, 'ejefac', v_fiscal_year, 'invoice_ids', v_invoice_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_facturas_apply_from_style(
  uuid, text, text, text, text, date, numeric, numeric, numeric, text, bigint, text
) TO service_role;

COMMENT ON FUNCTION dunasoft.style_facturas_apply_from_style IS
  'Style→Suite faccab. Clave map: ejefac/serie/numfac/codcli/empresa_emisora. Lookup factura por número + año fiscal.';
