-- Conflictos bidireccionales Style ↔ Suite + reparto fiscal ventas/facturas.
-- - Detecta divergencias incrementales (no pisa datos en conflicto).
-- - Notifica en campanita y marca la ficha de cliente.
-- - Ventas/facturas Style se reparten por billing_company_id del artículo.

-- ---------------------------------------------------------------------------
-- 1. Registro de conflictos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dunasoft.style_sync_conflicts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  entity_type   text NOT NULL,
  style_key     text,
  suite_id      uuid,
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  fields        jsonb NOT NULL DEFAULT '[]'::jsonb,
  suite_snapshot jsonb,
  style_snapshot jsonb,
  message       text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz,
  resolved_by   uuid
);

CREATE INDEX IF NOT EXISTS style_sync_conflicts_open_idx
  ON dunasoft.style_sync_conflicts (company_id, status, created_at DESC)
  WHERE status = 'open';

COMMENT ON TABLE dunasoft.style_sync_conflicts IS
  'Conflictos de sincronización bidireccional. status=open hasta resolución manual.';

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS style_sync_conflict_at timestamptz,
  ADD COLUMN IF NOT EXISTS style_sync_conflict_fields jsonb;

COMMENT ON COLUMN public.customers.style_sync_conflict_at IS
  'Marca de conflicto Style↔Suite pendiente de revisión en ficha cliente.';
COMMENT ON COLUMN public.customers.style_sync_conflict_fields IS
  'Campos en conflicto [{field, suite, style}] para mostrar en UI.';

-- ---------------------------------------------------------------------------
-- 2. Fix outbound: enqueue no debe depender solo de reservas sync_enabled
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.enqueue_style_entity(
  p_company_id  uuid,
  p_entity_type text,
  p_operation   text,
  p_style_key   text,
  p_suite_id    uuid,
  p_payload     jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_id bigint;
  v_ver bigint;
BEGIN
  v_ver := coalesce(
    (SELECT sync_version FROM dunasoft.style_sync_entity_map m
      WHERE m.company_id = p_company_id AND m.entity_type = p_entity_type
        AND m.suite_id = p_suite_id
      LIMIT 1),
    (SELECT sync_version FROM dunasoft.style_sync_entity_map m
      WHERE m.company_id = p_company_id AND m.entity_type = p_entity_type
        AND m.style_key = btrim(coalesce(p_style_key, ''))
      LIMIT 1),
    0
  ) + 1;

  INSERT INTO dunasoft.style_sync_outbox (
    company_id, entity_type, operation, style_key, suite_id, payload
  ) VALUES (
    p_company_id, p_entity_type, p_operation,
    NULLIF(btrim(coalesce(p_style_key, '')), ''), p_suite_id,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('sync_version', v_ver)
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Notificación campanita + marca en cliente
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.style_sync_raise_conflict(
  p_company_id    uuid,
  p_entity_type   text,
  p_style_key     text,
  p_suite_id      uuid,
  p_fields        jsonb,
  p_style_snapshot jsonb,
  p_suite_snapshot jsonb,
  p_message       text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_conflict_id uuid;
  v_customer_id uuid;
  v_title text;
  v_msg text;
  v_name text;
  v_rec record;
BEGIN
  INSERT INTO dunasoft.style_sync_conflicts (
    company_id, entity_type, style_key, suite_id, fields,
    style_snapshot, suite_snapshot, message
  ) VALUES (
    p_company_id, p_entity_type, p_style_key, p_suite_id, coalesce(p_fields, '[]'::jsonb),
    p_style_snapshot, p_suite_snapshot, p_message
  )
  RETURNING id INTO v_conflict_id;

  IF p_entity_type = 'customer' AND p_suite_id IS NOT NULL THEN
    v_customer_id := p_suite_id;
    SELECT name INTO v_name FROM public.customers WHERE id = v_customer_id;
    UPDATE public.customers SET
      style_sync_conflict_at = now(),
      style_sync_conflict_fields = coalesce(p_fields, '[]'::jsonb),
      updated_at = customers.updated_at
    WHERE id = v_customer_id;

    v_title := 'Conflicto sync Style · ' || coalesce(v_name, 'Cliente');
    v_msg := coalesce(
      p_message,
      'Style y Suite tienen datos distintos. Revisa la ficha y unifica los cambios.'
    );

    FOR v_rec IN
      SELECT DISTINCT up.user_id, up.company_id AS notify_company_id
      FROM public.user_profiles up
      JOIN public.companies host ON host.id = p_company_id
      JOIN public.companies c ON c.id = up.company_id
      WHERE up.company_id = p_company_id
         OR (host.work_center_id IS NOT NULL AND c.work_center_id = host.work_center_id)
    LOOP
      IF public.user_has_effective_permission(v_rec.user_id, 'clientes', 'read') THEN
        INSERT INTO public.notifications (
          company_id, user_id, title, message, type, link, read, metadata
        ) VALUES (
          v_rec.notify_company_id,
          v_rec.user_id,
          v_title,
          v_msg,
          'style_sync_conflict',
          '/clientes?customer=' || v_customer_id::text,
          false,
          jsonb_build_object(
            'customer_id', v_customer_id,
            'conflict_id', v_conflict_id,
            'entity_type', p_entity_type,
            'style_key', p_style_key,
            'fields', coalesce(p_fields, '[]'::jsonb)
          )
        );
      END IF;
    END LOOP;
  END IF;

  RETURN v_conflict_id;
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_sync_raise_conflict(
  uuid, text, text, uuid, jsonb, jsonb, jsonb, text
) TO service_role;

-- Resolver conflicto desde la ficha (usuario autenticado)
CREATE OR REPLACE FUNCTION public.style_sync_resolve_customer_conflict(p_customer_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = p_customer_id
      AND (c.company_id = public.get_user_company_id()
        OR public.company_in_user_work_center(c.company_id))
  ) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'sin permiso');
  END IF;

  UPDATE public.customers SET
    style_sync_conflict_at = NULL,
    style_sync_conflict_fields = NULL,
    updated_at = now()
  WHERE id = p_customer_id;

  UPDATE dunasoft.style_sync_conflicts SET
    status = 'resolved',
    resolved_at = now(),
    resolved_by = auth.uid()
  WHERE suite_id = p_customer_id AND entity_type = 'customer' AND status = 'open';

  UPDATE public.notifications SET read = true
  WHERE type = 'style_sync_conflict'
    AND metadata->>'customer_id' = p_customer_id::text
    AND read = false;

  RETURN jsonb_build_object('ok', true, 'customer_id', p_customer_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.style_sync_resolve_customer_conflict(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. Billing company por codart (centro laboral)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.style_resolve_billing_company_id(
  p_host_company_id uuid,
  p_codart text
)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(a.billing_company_id, af.billing_company_id, p_host_company_id)
      FROM public.articles a
      LEFT JOIN public.article_families af
        ON af.company_id = a.company_id AND af.name = a.familia
      WHERE a.company_id = p_host_company_id
        AND (
          btrim(coalesce(a.legacy_codart, '')) = btrim(coalesce(p_codart, ''))
          OR upper(btrim(coalesce(a.codigo, ''))) = upper(btrim(coalesce(p_codart, '')))
        )
      ORDER BY a.updated_at DESC NULLS LAST
      LIMIT 1
    ),
    p_host_company_id
  );
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_resolve_billing_company_id(uuid, text)
  TO service_role;

-- ---------------------------------------------------------------------------
-- 5. Clientes: LWW + detección de conflicto bidireccional
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.style_clientes_apply_from_style(
  p_company_id uuid,
  p_accion     text,
  p_codcli     text,
  p_nomcli     text,
  p_ape1       text,
  p_tel1       text,
  p_tel2       text,
  p_email      text,
  p_dni        text,
  p_dir        text,
  p_codpos     text,
  p_pob        text,
  p_pro        text,
  p_pais       text,
  p_percon     text,
  p_obs        text,
  p_fecnac     date,
  p_obsoleto   boolean,
  p_sync_version bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_accion text := upper(btrim(coalesce(p_accion, 'UPSERT')));
  v_codcli text := btrim(coalesce(p_codcli, ''));
  v_name   text := btrim(concat_ws(' ', nullif(btrim(coalesce(p_nomcli, '')), ''), nullif(btrim(coalesce(p_ape1, '')), '')));
  v_customer_id uuid;
  v_phone_home text := nullif(btrim(coalesce(p_tel1, '')), '');
  v_phone_mobile text := nullif(btrim(coalesce(p_tel2, '')), '');
  v_phone text := coalesce(nullif(btrim(coalesce(p_tel2, '')), ''), nullif(btrim(coalesce(p_tel1, '')), ''));
  v_new_norm text;
  v_norm_owner uuid;
  v_apply_phones boolean := true;
  v_map_ver bigint := 0;
  v_map_dir text;
  v_map_at timestamptz;
  v_suite_at timestamptz;
  v_pending_outbox boolean := false;
  v_fields jsonb := '[]'::jsonb;
  v_style_snap jsonb;
  v_suite_snap jsonb;
BEGIN
  IF v_codcli = '' OR v_codcli = '0' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codcli vacío');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  v_customer_id := dunasoft.style_map_suite_id(p_company_id, 'customer', v_codcli);
  IF v_customer_id IS NULL THEN
    SELECT c.id INTO v_customer_id
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND public.legacy_codcli_to_bigint(c.legacy_codcli)
          = public.legacy_codcli_to_bigint(v_codcli)
    LIMIT 1;
  END IF;

  IF v_accion IN ('DELETE', 'BAJA', 'BORRAR') THEN
    IF v_customer_id IS NOT NULL THEN
      PERFORM dunasoft.style_map_upsert(p_company_id, 'customer', v_codcli, v_customer_id, p_sync_version, 'style_to_suite');
    END IF;
    RETURN jsonb_build_object('ok', true, 'accion', 'DELETE', 'codcli', v_codcli, 'customer_id', v_customer_id);
  END IF;

  IF v_name = '' THEN v_name := 'Cliente ' || v_codcli; END IF;

  v_style_snap := jsonb_build_object(
    'name', v_name, 'email', coalesce(p_email, ''), 'phone', coalesce(v_phone, ''),
    'tax_id', coalesce(p_dni, ''), 'address_street', coalesce(p_dir, '')
  );

  IF v_customer_id IS NOT NULL THEN
    SELECT m.sync_version, m.last_direction, m.updated_at
    INTO v_map_ver, v_map_dir, v_map_at
    FROM dunasoft.style_sync_entity_map m
    WHERE m.company_id = p_company_id AND m.entity_type = 'customer' AND m.style_key = v_codcli;

    SELECT updated_at INTO v_suite_at FROM public.customers WHERE id = v_customer_id;

    SELECT EXISTS (
      SELECT 1 FROM dunasoft.style_sync_outbox o
      WHERE o.company_id = p_company_id AND o.entity_type = 'customer'
        AND o.suite_id = v_customer_id AND o.delivered_at IS NULL
    ) INTO v_pending_outbox;

    SELECT jsonb_build_object(
      'name', c.name, 'email', coalesce(c.email, ''), 'phone', coalesce(c.phone, ''),
      'tax_id', coalesce(c.tax_id, ''), 'address_street', coalesce(c.address_street, '')
    ) INTO v_suite_snap FROM public.customers c WHERE c.id = v_customer_id;

    -- Suite editó después del último acuerdo y Style trae valores distintos → conflicto
    IF (v_pending_outbox OR (v_map_dir = 'suite_to_style' AND coalesce(p_sync_version, 0) <= coalesce(v_map_ver, 0)))
       AND v_suite_at IS NOT NULL AND v_map_at IS NOT NULL
       AND v_suite_at > v_map_at - interval '1 second'
    THEN
      IF btrim(coalesce(v_style_snap->>'name', '')) <> btrim(coalesce(v_suite_snap->>'name', ''))
         AND btrim(coalesce(v_style_snap->>'name', '')) <> '' THEN
        v_fields := v_fields || jsonb_build_array(jsonb_build_object('field', 'name', 'style', v_style_snap->>'name', 'suite', v_suite_snap->>'name'));
      END IF;
      IF btrim(coalesce(v_style_snap->>'email', '')) <> btrim(coalesce(v_suite_snap->>'email', ''))
         AND btrim(coalesce(v_style_snap->>'email', '')) <> ''
         AND btrim(coalesce(v_suite_snap->>'email', '')) <> '' THEN
        v_fields := v_fields || jsonb_build_array(jsonb_build_object('field', 'email', 'style', v_style_snap->>'email', 'suite', v_suite_snap->>'email'));
      END IF;
      IF btrim(coalesce(v_style_snap->>'phone', '')) <> btrim(coalesce(v_suite_snap->>'phone', ''))
         AND btrim(coalesce(v_style_snap->>'phone', '')) <> ''
         AND btrim(coalesce(v_suite_snap->>'phone', '')) <> '' THEN
        v_fields := v_fields || jsonb_build_array(jsonb_build_object('field', 'phone', 'style', v_style_snap->>'phone', 'suite', v_suite_snap->>'phone'));
      END IF;
      IF btrim(coalesce(v_style_snap->>'tax_id', '')) <> btrim(coalesce(v_suite_snap->>'tax_id', ''))
         AND btrim(coalesce(v_style_snap->>'tax_id', '')) <> ''
         AND btrim(coalesce(v_suite_snap->>'tax_id', '')) <> '' THEN
        v_fields := v_fields || jsonb_build_array(jsonb_build_object('field', 'tax_id', 'style', v_style_snap->>'tax_id', 'suite', v_suite_snap->>'tax_id'));
      END IF;

      IF jsonb_array_length(v_fields) > 0 THEN
        PERFORM dunasoft.style_sync_raise_conflict(
          p_company_id, 'customer', v_codcli, v_customer_id, v_fields,
          v_style_snap, v_suite_snap,
          'Style y Suite modificaron datos distintos del cliente. Revisa la ficha.'
        );
        RETURN jsonb_build_object(
          'ok', false, 'conflict', true, 'codcli', v_codcli,
          'customer_id', v_customer_id, 'fields', v_fields
        );
      END IF;
    END IF;
  END IF;

  v_new_norm := public.customer_primary_phone_last9(v_phone, v_phone_mobile, v_phone_home);
  IF v_new_norm IS NOT NULL THEN
    SELECT c.id INTO v_norm_owner
    FROM public.customers c
    WHERE c.company_id = p_company_id AND c.phone_norm = v_new_norm
    LIMIT 1;
    IF v_norm_owner IS NOT NULL AND v_norm_owner IS DISTINCT FROM v_customer_id THEN
      v_apply_phones := false;
    END IF;
  END IF;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      id, company_id, legacy_codcli, name, email, tax_id,
      address_street, address_postal_code, address_city, address_state, address_country,
      contact_person, notes, birth_date, phone_home, phone_mobile, phone
    ) VALUES (
      gen_random_uuid(), p_company_id, v_codcli, v_name,
      nullif(btrim(coalesce(p_email, '')), ''),
      nullif(btrim(coalesce(p_dni, '')), ''),
      nullif(btrim(coalesce(p_dir, '')), ''),
      nullif(btrim(coalesce(p_codpos, '')), ''),
      nullif(btrim(coalesce(p_pob, '')), ''),
      nullif(btrim(coalesce(p_pro, '')), ''),
      coalesce(nullif(btrim(coalesce(p_pais, '')), ''), 'España'),
      nullif(btrim(coalesce(p_percon, '')), ''),
      nullif(btrim(coalesce(p_obs, '')), ''),
      p_fecnac,
      CASE WHEN v_apply_phones THEN v_phone_home END,
      CASE WHEN v_apply_phones THEN v_phone_mobile END,
      CASE WHEN v_apply_phones THEN v_phone END
    )
    RETURNING id INTO v_customer_id;
  ELSE
    UPDATE public.customers SET
      legacy_codcli = coalesce(nullif(btrim(legacy_codcli), ''), v_codcli),
      name = v_name,
      email = coalesce(nullif(btrim(coalesce(p_email, '')), ''), email),
      tax_id = coalesce(nullif(btrim(coalesce(p_dni, '')), ''), tax_id),
      address_street = coalesce(nullif(btrim(coalesce(p_dir, '')), ''), address_street),
      address_postal_code = coalesce(nullif(btrim(coalesce(p_codpos, '')), ''), address_postal_code),
      address_city = coalesce(nullif(btrim(coalesce(p_pob, '')), ''), address_city),
      address_state = coalesce(nullif(btrim(coalesce(p_pro, '')), ''), address_state),
      address_country = coalesce(nullif(btrim(coalesce(p_pais, '')), ''), address_country),
      contact_person = coalesce(nullif(btrim(coalesce(p_percon, '')), ''), contact_person),
      birth_date = coalesce(p_fecnac, birth_date),
      phone_home = CASE WHEN v_apply_phones THEN coalesce(v_phone_home, phone_home) ELSE phone_home END,
      phone_mobile = CASE WHEN v_apply_phones THEN coalesce(v_phone_mobile, phone_mobile) ELSE phone_mobile END,
      phone = CASE WHEN v_apply_phones THEN coalesce(v_phone, phone) ELSE phone END,
      style_sync_conflict_at = NULL,
      style_sync_conflict_fields = NULL,
      updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  PERFORM dunasoft.style_map_upsert(p_company_id, 'customer', v_codcli, v_customer_id, p_sync_version, 'style_to_suite');

  RETURN jsonb_build_object('ok', true, 'accion', 'UPSERT', 'codcli', v_codcli, 'customer_id', v_customer_id);
END;
$$;

-- ACK Suite→Style: incrementa sync_version en mapeo
CREATE OR REPLACE FUNCTION dunasoft.style_entity_ack(
  p_company_id  uuid,
  p_outbox_id   bigint,
  p_style_key   text,
  p_ok          boolean,
  p_error       text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_row dunasoft.style_sync_outbox%ROWTYPE;
  v_ver bigint;
BEGIN
  SELECT * INTO v_row
  FROM dunasoft.style_sync_outbox
  WHERE id = p_outbox_id AND company_id = p_company_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Outbox no encontrada');
  END IF;

  v_ver := coalesce((v_row.payload->>'sync_version')::bigint, 0);

  IF p_ok THEN
    UPDATE dunasoft.style_sync_outbox
    SET delivered_at = now(), error = NULL
    WHERE id = p_outbox_id;

    IF v_row.suite_id IS NOT NULL THEN
      PERFORM dunasoft.style_map_upsert(
        p_company_id, v_row.entity_type,
        coalesce(nullif(btrim(p_style_key), ''), v_row.style_key),
        v_row.suite_id, v_ver, 'suite_to_style'
      );
    END IF;
  ELSE
    UPDATE dunasoft.style_sync_outbox
    SET error = coalesce(p_error, 'Style rechazó'), attempts = attempts + 1
    WHERE id = p_outbox_id;
  END IF;

  RETURN jsonb_build_object('ok', p_ok, 'outbox_id', p_outbox_id, 'style_key', p_style_key);
END;
$$;

-- ---------------------------------------------------------------------------
-- 6. Ventas con reparto fiscal por línea (alblin)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.style_ventas_apply_from_style(
  p_company_id uuid,
  p_accion     text,
  p_numalb     text,
  p_serie      text,
  p_codcli     text,
  p_fecha      date,
  p_total      numeric,
  p_lineas     text DEFAULT '[]',
  p_sync_version bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_accion text := upper(btrim(coalesce(p_accion, 'UPSERT')));
  v_numalb text := btrim(coalesce(p_numalb, ''));
  v_serie text := btrim(coalesce(p_serie, ''));
  v_key text;
  v_scale numeric := dunasoft.style_price_scale(p_company_id);
  v_total numeric := coalesce(p_total, 0) * v_scale;
  v_customer_id uuid;
  v_customer_name text;
  v_lines jsonb;
  v_line jsonb;
  v_billing uuid;
  v_line_total numeric;
  v_bucket record;
  v_sale_id uuid;
  v_ticket text;
  v_prefix text;
  v_subtotal numeric;
  v_tax numeric;
  v_sale_ids jsonb := '[]'::jsonb;
  v_groups int := 0;
BEGIN
  IF v_numalb = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'numalb vacío');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  v_customer_id := dunasoft.style_map_suite_id(p_company_id, 'customer', btrim(coalesce(p_codcli, '')));
  IF v_customer_id IS NULL AND btrim(coalesce(p_codcli, '')) NOT IN ('', '0') THEN
    SELECT c.id, c.name INTO v_customer_id, v_customer_name
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND public.legacy_codcli_to_bigint(c.legacy_codcli) = public.legacy_codcli_to_bigint(p_codcli)
    LIMIT 1;
  ELSIF v_customer_id IS NOT NULL THEN
    SELECT name INTO v_customer_name FROM public.customers WHERE id = v_customer_id;
  END IF;

  IF v_accion IN ('DELETE', 'BAJA', 'BORRAR') THEN
    FOR v_sale_id IN
      SELECT suite_id FROM dunasoft.style_sync_entity_map
      WHERE company_id = p_company_id AND entity_type = 'sale'
        AND style_key LIKE v_serie || '/' || v_numalb || '%'
    LOOP
      UPDATE public.sales SET status = 'cancelled', updated_at = now() WHERE id = v_sale_id;
    END LOOP;
    RETURN jsonb_build_object('ok', true, 'accion', 'DELETE', 'numalb', v_numalb);
  END IF;

  v_lines := coalesce(NULLIF(btrim(coalesce(p_lineas, '')), '')::jsonb, '[]'::jsonb);

  CREATE TEMP TABLE IF NOT EXISTS tmp_style_sale_buckets (
    billing_company_id uuid PRIMARY KEY,
    total_amount numeric NOT NULL DEFAULT 0
  ) ON COMMIT DROP;
  TRUNCATE tmp_style_sale_buckets;

  IF jsonb_typeof(v_lines) = 'array' AND jsonb_array_length(v_lines) > 0 THEN
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
      v_billing := dunasoft.style_resolve_billing_company_id(
        p_company_id, btrim(coalesce(v_line->>'codart', ''))
      );
      v_line_total := coalesce((v_line->>'total')::numeric, 0) * v_scale;
      INSERT INTO tmp_style_sale_buckets (billing_company_id, total_amount)
      VALUES (v_billing, v_line_total)
      ON CONFLICT (billing_company_id) DO UPDATE SET
        total_amount = tmp_style_sale_buckets.total_amount + EXCLUDED.total_amount;
    END LOOP;
    SELECT count(*) INTO v_groups FROM tmp_style_sale_buckets;
  ELSE
    INSERT INTO tmp_style_sale_buckets (billing_company_id, total_amount)
    VALUES (p_company_id, v_total);
    v_groups := 1;
  END IF;

  FOR v_bucket IN SELECT * FROM tmp_style_sale_buckets WHERE total_amount <> 0 LOOP
    v_key := v_serie || '/' || v_numalb || '/' || v_bucket.billing_company_id::text;
    SELECT tpv_ticket_prefix INTO v_prefix FROM public.companies WHERE id = v_bucket.billing_company_id;
    v_ticket := 'STY-' || coalesce(nullif(v_serie, ''), '0') || '-' || v_numalb;
    IF v_groups > 1 AND v_prefix IS NOT NULL THEN
      v_ticket := v_ticket || '-' || v_prefix;
    END IF;

    v_subtotal := round(v_bucket.total_amount / 1.21, 2);
    v_tax := round(v_bucket.total_amount - v_subtotal, 2);

    v_sale_id := dunasoft.style_map_suite_id(p_company_id, 'sale', v_key);
    IF v_sale_id IS NULL THEN
      SELECT id INTO v_sale_id FROM public.sales
      WHERE company_id = v_bucket.billing_company_id AND ticket_number = v_ticket LIMIT 1;
    END IF;

    IF v_sale_id IS NULL THEN
      INSERT INTO public.sales (
        id, company_id, host_company_id, ticket_number, total_amount, subtotal, tax_amount,
        payment_method, status, customer_id, customer_name, created_at
      ) VALUES (
        gen_random_uuid(), v_bucket.billing_company_id, p_company_id, v_ticket,
        v_bucket.total_amount, v_subtotal, v_tax,
        'cash', 'completed', v_customer_id, v_customer_name,
        coalesce(p_fecha::timestamptz, now())
      )
      RETURNING id INTO v_sale_id;
    ELSE
      UPDATE public.sales SET
        host_company_id = p_company_id,
        total_amount = v_bucket.total_amount,
        subtotal = v_subtotal,
        tax_amount = v_tax,
        customer_id = coalesce(v_customer_id, customer_id),
        customer_name = coalesce(v_customer_name, customer_name),
        status = CASE WHEN status = 'cancelled' THEN 'completed' ELSE status END,
        updated_at = now()
      WHERE id = v_sale_id;
    END IF;

    IF jsonb_typeof(v_lines) = 'array' AND jsonb_array_length(v_lines) > 0 THEN
      DELETE FROM public.sale_items WHERE sale_id = v_sale_id;
      FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
        v_billing := dunasoft.style_resolve_billing_company_id(
          p_company_id, btrim(coalesce(v_line->>'codart', ''))
        );
        IF v_billing <> v_bucket.billing_company_id THEN CONTINUE; END IF;
        INSERT INTO public.sale_items (sale_id, article_id, description, quantity, unit_price, total_price)
        VALUES (
          v_sale_id,
          (SELECT id FROM public.articles
            WHERE company_id = p_company_id
              AND legacy_codart = btrim(coalesce(v_line->>'codart', '')) LIMIT 1),
          coalesce(v_line->>'desart', v_line->>'codart', ''),
          coalesce((v_line->>'cantidad')::numeric, 1),
          coalesce((v_line->>'precio')::numeric, 0) * v_scale,
          coalesce((v_line->>'total')::numeric, 0) * v_scale
        );
      END LOOP;
    END IF;

    PERFORM dunasoft.style_map_upsert(p_company_id, 'sale', v_key, v_sale_id, p_sync_version, 'style_to_suite');
    v_sale_ids := v_sale_ids || jsonb_build_array(v_sale_id);
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'accion', 'UPSERT', 'numalb', v_numalb, 'sale_ids', v_sale_ids);
END;
$$;

-- ---------------------------------------------------------------------------
-- 7. Facturas con reparto fiscal por línea (faclin)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS dunasoft.style_facturas_apply_from_style(
  uuid, text, text, text, text, date, numeric, numeric, numeric, bigint
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
  p_sync_version bigint DEFAULT 0
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
  v_scale numeric := dunasoft.style_price_scale(p_company_id);
  v_customer_id uuid;
  v_lines jsonb;
  v_line jsonb;
  v_billing uuid;
  v_bucket record;
  v_invoice_id uuid;
  v_key text;
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
        AND style_key LIKE v_serie || '/' || v_numfac || '/' || v_codcli || '%'
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
    v_key := v_serie || '/' || v_numfac || '/' || v_codcli || '/' || v_bucket.billing_company_id::text;
    SELECT tpv_ticket_prefix INTO v_prefix FROM public.companies WHERE id = v_bucket.billing_company_id;
    v_number := coalesce(nullif(v_serie, ''), 'A') || '-' || v_numfac;
    IF v_groups > 1 AND v_prefix IS NOT NULL THEN
      v_number := v_number || '-' || v_prefix;
    END IF;

    v_invoice_id := dunasoft.style_map_suite_id(p_company_id, 'invoice', v_key);
    IF v_invoice_id IS NULL THEN
      SELECT id INTO v_invoice_id FROM public.invoices
      WHERE company_id = v_bucket.billing_company_id AND number = v_number LIMIT 1;
    END IF;

    IF v_invoice_id IS NULL THEN
      INSERT INTO public.invoices (
        id, company_id, customer_id, number, issue_date, due_date, status,
        subtotal, tax_amount, total_amount, notes
      ) VALUES (
        gen_random_uuid(), v_bucket.billing_company_id, v_customer_id, v_number,
        coalesce(p_fecha, current_date), coalesce(p_fecha, current_date),
        'paid', v_bucket.subtotal, v_bucket.tax, v_bucket.total,
        'Factura Style sync'
      )
      RETURNING id INTO v_invoice_id;
    ELSE
      UPDATE public.invoices SET
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

  RETURN jsonb_build_object('ok', true, 'accion', 'UPSERT', 'numfac', v_numfac, 'invoice_ids', v_invoice_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_facturas_apply_from_style(
  uuid, text, text, text, text, date, numeric, numeric, numeric, text, bigint
) TO service_role;

-- Activar ventas y facturas en Mar Lamas (host)
UPDATE dunasoft.style_sync_cursor
SET enabled = true, last_error = NULL, updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND tabla IN ('albcab', 'faccab');
