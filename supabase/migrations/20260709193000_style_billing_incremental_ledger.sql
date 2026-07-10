-- Facturación incremental: registro fiscal por factura Style, checkpoints de mantenimiento
-- y invalidación de caché del dashboard (sin resync masivo repetido).

-- ---------------------------------------------------------------------------
-- 1. Ledger fiscal (totfac verificado por style_key)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dunasoft.style_sync_billing_fiscal (
  company_id       uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  style_key        text NOT NULL,
  suite_invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  fiscal_total     numeric NOT NULL,
  fiscal_date      date NOT NULL,
  sync_version     bigint,
  verified_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, style_key)
);

CREATE INDEX IF NOT EXISTS idx_style_sync_billing_fiscal_invoice
  ON dunasoft.style_sync_billing_fiscal (suite_invoice_id);

CREATE INDEX IF NOT EXISTS idx_style_sync_billing_fiscal_date
  ON dunasoft.style_sync_billing_fiscal (company_id, fiscal_date);

COMMENT ON TABLE dunasoft.style_sync_billing_fiscal IS
  'Importe fiscal (totfac) ya alineado por factura Style. Evita re-reconciliar en cada sync.';

GRANT SELECT, INSERT, UPDATE, DELETE ON dunasoft.style_sync_billing_fiscal TO service_role;

-- ---------------------------------------------------------------------------
-- 2. Checkpoints de mantenimiento (dedupe, resync histórico, etc.)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dunasoft.style_sync_billing_checkpoints (
  company_id     uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  checkpoint_key text NOT NULL,
  applied_at     timestamptz NOT NULL DEFAULT now(),
  details        jsonb,
  PRIMARY KEY (company_id, checkpoint_key)
);

COMMENT ON TABLE dunasoft.style_sync_billing_checkpoints IS
  'Tareas de facturación ya ejecutadas (p. ej. dedupe A-N 2026). Scripts comprueban antes de repetir.';

GRANT SELECT, INSERT, UPDATE ON dunasoft.style_sync_billing_checkpoints TO service_role;

CREATE OR REPLACE FUNCTION dunasoft.style_billing_checkpoint_done(
  p_company_id uuid,
  p_key text
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft
AS $$
  SELECT EXISTS (
    SELECT 1 FROM dunasoft.style_sync_billing_checkpoints
    WHERE company_id = p_company_id AND checkpoint_key = btrim(p_key)
  );
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_billing_checkpoint_done(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- 3. Invalidar caché del dashboard (mes/año afectado)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.dashboard_billing_invalidate(
  p_company_id uuid,
  p_issue_date date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_hub uuid := dunasoft.style_sync_hub_company_id();
  v_d date := coalesce(p_issue_date, current_date);
  v_year text := extract(year FROM v_d)::text;
  v_ym text := to_char(v_d, 'YYYY-MM');
BEGIN
  DELETE FROM public.dashboard_billing_query_cache c
  WHERE c.company_id IN (p_company_id, v_hub)
    AND (
      c.cache_key LIKE '%:' || v_year || ':%'
      OR c.cache_key LIKE '%:' || v_year
      OR c.cache_key LIKE '%' || v_ym || '%'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_billing_invalidate(uuid, date) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Superseder A-N cuando entra canónica A-YYYY-N (idempotente)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.style_billing_supersede_legacy_short_number(
  p_company_id   uuid,
  p_fiscal_year  int,
  p_serie        text,
  p_numfac       text,
  p_codcli       text,
  p_canonical_key text
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_legacy_id uuid;
  v_legacy_key text;
  v_count int := 0;
  v_short_number text := coalesce(nullif(btrim(p_serie), ''), 'A') || '-' || btrim(p_numfac);
BEGIN
  FOR v_legacy_id, v_legacy_key IN
    SELECT i.id, m.style_key
    FROM public.invoices i
    INNER JOIN dunasoft.style_sync_entity_map m
      ON m.suite_id = i.id AND m.entity_type = 'invoice'
    WHERE m.company_id = p_company_id
      AND m.style_key LIKE p_fiscal_year::text || '/' || coalesce(nullif(btrim(p_serie), ''), 'A') || '/'
        || btrim(p_numfac) || '/' || btrim(p_codcli) || '/%'
      AND i.number = v_short_number
      AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
      AND m.style_key IS DISTINCT FROM p_canonical_key
  LOOP
    UPDATE public.invoices i
    SET status = 'cancelled',
        notes = coalesce(i.notes, '') || E'\nSuperseded by ' || p_canonical_key,
        updated_at = now()
    WHERE i.id = v_legacy_id;

    INSERT INTO dunasoft.style_sync_billing_exclusions (company_id, style_key, reason)
    VALUES (
      p_company_id,
      v_legacy_key,
      'Superseded by canonical ' || p_canonical_key
    )
    ON CONFLICT (company_id, style_key) DO UPDATE
    SET reason = EXCLUDED.reason;

    DELETE FROM dunasoft.style_sync_billing_fiscal
    WHERE company_id = p_company_id AND style_key = v_legacy_key;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_billing_supersede_legacy_short_number(uuid, int, text, text, text, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 5. style_facturas_apply: ledger + supersede + invalidar caché
-- ---------------------------------------------------------------------------
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
  v_groups int := 0;
  v_invoice_ids jsonb := '[]'::jsonb;
  v_lines_sum numeric;
  v_target_total numeric;
  v_target_subtotal numeric;
  v_target_tax numeric;
  v_line_scale numeric := 1;
  v_remainder numeric;
  v_fiscal_date date;
  v_skip_reconcile boolean := false;
BEGIN
  IF v_numfac = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'numfac vacío');
  END IF;

  IF dunasoft.style_invoice_sync_excluded(p_company_id, v_serie, v_numfac, v_codcli) THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true, 'reason', 'factura excluida (errónea)');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);
  v_fiscal_date := coalesce(p_fecha, make_date(v_fiscal_year, 1, 1));
  v_target_total := coalesce(p_total, 0) * v_scale;

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
    PERFORM public.dashboard_billing_invalidate(p_company_id, v_fiscal_date);
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

    SELECT coalesce(sum(total), 0) INTO v_lines_sum FROM tmp_style_inv_buckets;
    v_target_subtotal := coalesce(p_baseimp, 0) * v_scale;
    v_target_tax := coalesce(p_iva, 0) * v_scale;

    SELECT EXISTS (
      SELECT 1 FROM dunasoft.style_sync_billing_fiscal f
      WHERE f.company_id = p_company_id
        AND f.style_key LIKE v_fiscal_year::text || '/' || coalesce(nullif(v_serie, ''), 'A') || '/'
          || v_numfac || '/' || v_codcli || '/%'
        AND f.fiscal_total = v_target_total
        AND f.fiscal_date = v_fiscal_date
        AND coalesce(f.sync_version, 0) = coalesce(p_sync_version, 0)
    ) INTO v_skip_reconcile;

    IF NOT v_skip_reconcile
       AND v_lines_sum > 0
       AND v_target_total > 0
       AND abs(v_lines_sum - v_target_total) > 0.01 THEN
      v_line_scale := v_target_total / v_lines_sum;
      UPDATE tmp_style_inv_buckets SET
        total = round((total / v_lines_sum) * v_target_total, 2),
        subtotal = round((subtotal / v_lines_sum) * v_target_subtotal, 2),
        tax = round((tax / v_lines_sum) * v_target_tax, 2)
      WHERE billing_company_id IS NOT NULL;
      SELECT coalesce(sum(total), 0) INTO v_lines_sum FROM tmp_style_inv_buckets;
      v_remainder := round(v_target_total - v_lines_sum, 2);
      IF abs(v_remainder) >= 0.01 THEN
        UPDATE tmp_style_inv_buckets SET total = total + v_remainder
        WHERE billing_company_id = (
          SELECT billing_company_id FROM tmp_style_inv_buckets ORDER BY total DESC LIMIT 1
        );
      END IF;
    END IF;
  ELSE
    INSERT INTO tmp_style_inv_buckets (billing_company_id, subtotal, tax, total)
    VALUES (
      p_company_id,
      coalesce(p_baseimp, 0) * v_scale,
      coalesce(p_iva, 0) * v_scale,
      coalesce(p_total, 0) * v_scale
    );
    v_groups := 1;
    v_line_scale := 1;
  END IF;

  FOR v_bucket IN SELECT * FROM tmp_style_inv_buckets WHERE total <> 0 LOOP
    v_old_key := v_serie || '/' || v_numfac || '/' || v_codcli || '/' || v_bucket.billing_company_id::text;
    v_key := v_fiscal_year::text || '/' || v_old_key;

    SELECT tpv_ticket_prefix INTO v_prefix FROM public.companies WHERE id = v_bucket.billing_company_id;
    v_number := coalesce(nullif(v_serie, ''), 'A') || '-' || v_numfac;
    IF v_groups > 1 AND v_prefix IS NOT NULL THEN
      v_number := v_number || '-' || v_prefix;
    END IF;

    PERFORM dunasoft.style_billing_supersede_legacy_short_number(
      p_company_id, v_fiscal_year, v_serie, v_numfac, v_codcli, v_key
    );

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
        v_fiscal_date, v_fiscal_date,
        'paid', v_bucket.subtotal, v_bucket.tax, v_bucket.total,
        'Factura Style sync'
      )
      RETURNING id INTO v_invoice_id;
    ELSE
      UPDATE public.invoices SET
        customer_id = v_customer_id,
        issue_date = v_fiscal_date,
        due_date = v_fiscal_date,
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
          round(coalesce((v_line->>'precio')::numeric, 0) * v_scale * v_line_scale, 2),
          round(coalesce((v_line->>'total')::numeric, (v_line->>'subtot')::numeric, 0) * v_scale * v_line_scale, 2)
        );
      END LOOP;
    END IF;

    PERFORM dunasoft.style_map_upsert(p_company_id, 'invoice', v_key, v_invoice_id, p_sync_version, 'style_to_suite');

    INSERT INTO dunasoft.style_sync_billing_fiscal (
      company_id, style_key, suite_invoice_id, fiscal_total, fiscal_date, sync_version, verified_at
    ) VALUES (
      p_company_id, v_key, v_invoice_id, v_bucket.total, v_fiscal_date, p_sync_version, now()
    )
    ON CONFLICT (company_id, style_key) DO UPDATE SET
      suite_invoice_id = EXCLUDED.suite_invoice_id,
      fiscal_total = EXCLUDED.fiscal_total,
      fiscal_date = EXCLUDED.fiscal_date,
      sync_version = EXCLUDED.sync_version,
      verified_at = now();

    v_invoice_ids := v_invoice_ids || jsonb_build_array(v_invoice_id);
  END LOOP;

  PERFORM public.dashboard_billing_invalidate(p_company_id, v_fiscal_date);

  RETURN jsonb_build_object(
    'ok', true, 'accion', 'UPSERT', 'numfac', v_numfac,
    'ejefac', v_fiscal_year, 'invoice_ids', v_invoice_ids,
    'fiscal_date', v_fiscal_date
  );
END;
$$;

COMMENT ON FUNCTION dunasoft.style_facturas_apply_from_style IS
  'Style→Suite faccab: totfac, ledger fiscal, dedupe A-N, invalida caché dashboard.';

-- ---------------------------------------------------------------------------
-- 6. Cierre de caja Style → invalidar caché del mes (facturas del día en Style)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.style_caja_apply_from_style(
  p_company_id uuid,
  p_accion     text,
  p_numcie     text,
  p_fecha      date,
  p_efectivo   numeric,
  p_tarjeta    numeric,
  p_total      numeric,
  p_sync_version bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_accion text := upper(btrim(coalesce(p_accion, 'UPSERT')));
  v_numcie text := btrim(coalesce(p_numcie, ''));
  v_scale numeric := dunasoft.style_price_scale(p_company_id);
  v_efectivo numeric := coalesce(p_efectivo, 0) * v_scale;
  v_tarjeta numeric := coalesce(p_tarjeta, 0) * v_scale;
  v_total numeric := coalesce(p_total, 0) * v_scale;
  v_session_date date := coalesce(p_fecha, current_date);
  v_session_id uuid;
  v_day_sales numeric;
  v_diff numeric;
  v_notes text := 'Cierre Style ' || v_numcie;
BEGIN
  IF v_numcie = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'numcie vacío');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  IF v_accion IN ('DELETE', 'BAJA', 'BORRAR') THEN
    SELECT id INTO v_session_id FROM dunasoft.style_sync_entity_map_session(p_company_id, v_numcie);
    IF v_session_id IS NOT NULL THEN
      UPDATE public.cash_register_sessions SET status = 'cancelled', updated_at = now()
      WHERE id = v_session_id;
    END IF;
    PERFORM public.dashboard_billing_invalidate(p_company_id, v_session_date);
    RETURN jsonb_build_object('ok', true, 'accion', 'DELETE', 'numcie', v_numcie);
  END IF;

  SELECT COALESCE(SUM(total_amount), 0) INTO v_day_sales
  FROM public.sales
  WHERE company_id = p_company_id
    AND status = 'completed'
    AND created_at::date = v_session_date;
  v_diff := round(v_total - v_day_sales, 2);
  IF abs(v_diff) > 1 THEN
    v_notes := v_notes || ' | aviso descuadre vs ventas Suite: ' || v_diff::text;
  END IF;

  SELECT id INTO v_session_id
  FROM public.cash_register_sessions
  WHERE company_id = p_company_id AND session_date = v_session_date
  LIMIT 1;

  IF v_session_id IS NULL THEN
    INSERT INTO public.cash_register_sessions (
      id, company_id, session_date, status, opened_at, opening_cash,
      closed_at, expected_cash, expected_card, counted_cash, counted_card,
      closing_cash, notes
    ) VALUES (
      gen_random_uuid(), p_company_id, v_session_date, 'closed', now(), 0,
      now(), v_efectivo, v_tarjeta, v_efectivo, v_tarjeta, v_total, v_notes
    )
    RETURNING id INTO v_session_id;
  ELSE
    UPDATE public.cash_register_sessions SET
      status = 'closed',
      closed_at = coalesce(closed_at, now()),
      expected_cash = v_efectivo,
      expected_card = v_tarjeta,
      counted_cash = v_efectivo,
      counted_card = v_tarjeta,
      closing_cash = v_total,
      notes = v_notes,
      updated_at = now()
    WHERE id = v_session_id;
  END IF;

  PERFORM dunasoft.style_map_upsert(p_company_id, 'cash_session', v_numcie, v_session_id, p_sync_version, 'style_to_suite');
  PERFORM public.dashboard_billing_invalidate(p_company_id, v_session_date);

  RETURN jsonb_build_object(
    'ok', true, 'accion', 'UPSERT', 'numcie', v_numcie,
    'session_id', v_session_id, 'day_sales', v_day_sales, 'diff', v_diff
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Sembrar ledger + checkpoints por trabajo ya hecho
-- ---------------------------------------------------------------------------
INSERT INTO dunasoft.style_sync_billing_checkpoints (company_id, checkpoint_key, details)
SELECT dunasoft.style_sync_hub_company_id(), k.key, k.details
FROM (VALUES
  ('totfac_reconcile_v1', '{"migration":"20260709170000"}'::jsonb),
  ('dedupe_an_cross_company_2026', '{"migration":"20260709172000"}'::jsonb),
  ('fiscal_ledger_v1', '{"migration":"20260709193000"}'::jsonb)
) AS k(key, details)
ON CONFLICT (company_id, checkpoint_key) DO NOTHING;

INSERT INTO dunasoft.style_sync_billing_fiscal (
  company_id, style_key, suite_invoice_id, fiscal_total, fiscal_date, sync_version, verified_at
)
SELECT
  m.company_id,
  m.style_key,
  i.id,
  i.total_amount,
  i.issue_date::date,
  m.sync_version,
  coalesce(m.updated_at, now())
FROM dunasoft.style_sync_entity_map m
JOIN public.invoices i ON i.id = m.suite_id
WHERE m.entity_type = 'invoice'
  AND m.company_id = dunasoft.style_sync_hub_company_id()
  AND m.style_key ~ '^[0-9]{4}/'
  AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
ON CONFLICT (company_id, style_key) DO NOTHING;
