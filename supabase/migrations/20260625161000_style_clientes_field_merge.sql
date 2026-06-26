-- Merge por campo en clientes Style ↔ Suite.
-- Conflicto solo si el MISMO campo cambió en ambos lados dentro de 5 minutos.
-- Campos distintos se fusionan; fuera de la ventana gana el más reciente (LWW).

ALTER TABLE dunasoft.style_sync_entity_map
  ADD COLUMN IF NOT EXISTS field_snapshot jsonb;

COMMENT ON COLUMN dunasoft.style_sync_entity_map.field_snapshot IS
  'Último estado acordado de campos trackeados (baseline para merge incremental).';

-- ---------------------------------------------------------------------------
-- Helpers de merge
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.style_sync_ts_from_version(p_sync_version bigint)
RETURNS timestamptz
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN coalesce(p_sync_version, 0) > 1000000000000
      THEN to_timestamp(p_sync_version / 1000.0)
    WHEN coalesce(p_sync_version, 0) > 1000000000
      THEN to_timestamp(p_sync_version::double precision)
    ELSE NULL::timestamptz
  END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.style_sync_merge_scalar(
  p_style_val    text,
  p_suite_val    text,
  p_baseline_val text,
  p_style_ts     timestamptz,
  p_suite_ts     timestamptz,
  p_style_touched boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_style text := nullif(btrim(coalesce(p_style_val, '')), '');
  v_suite text := nullif(btrim(coalesce(p_suite_val, '')), '');
  v_base  text := nullif(btrim(coalesce(p_baseline_val, '')), '');
  v_style_ch boolean;
  v_suite_ch boolean;
  v_window constant interval := interval '5 minutes';
BEGIN
  IF NOT coalesce(p_style_touched, true) THEN
    v_style := v_base;
  END IF;

  v_style_ch := v_style IS DISTINCT FROM v_base;
  v_suite_ch := v_suite IS DISTINCT FROM v_base;

  IF NOT v_style_ch AND NOT v_suite_ch THEN
    RETURN jsonb_build_object('value', v_suite, 'conflict', false);
  END IF;

  IF v_style_ch AND NOT v_suite_ch THEN
    RETURN jsonb_build_object('value', coalesce(v_style, v_suite), 'conflict', false);
  END IF;

  IF v_suite_ch AND NOT v_style_ch THEN
    RETURN jsonb_build_object('value', v_suite, 'conflict', false);
  END IF;

  IF v_style IS NOT DISTINCT FROM v_suite THEN
    RETURN jsonb_build_object('value', v_suite, 'conflict', false);
  END IF;

  IF p_style_ts IS NOT NULL
     AND p_suite_ts IS NOT NULL
     AND abs(extract(epoch from (p_style_ts - p_suite_ts))) <= extract(epoch from v_window) THEN
    RETURN jsonb_build_object(
      'value', v_suite,
      'conflict', true,
      'style', coalesce(v_style, ''),
      'suite', coalesce(v_suite, '')
    );
  END IF;

  IF p_style_ts IS NOT NULL AND p_suite_ts IS NOT NULL AND p_style_ts >= p_suite_ts THEN
    RETURN jsonb_build_object('value', v_style, 'conflict', false);
  END IF;

  RETURN jsonb_build_object('value', v_suite, 'conflict', false);
END;
$$;

CREATE OR REPLACE FUNCTION dunasoft.style_map_upsert(
  p_company_id  uuid,
  p_entity_type text,
  p_style_key   text,
  p_suite_id    uuid,
  p_sync_version bigint DEFAULT 0,
  p_direction   text DEFAULT 'style_to_suite',
  p_field_snapshot jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  INSERT INTO dunasoft.style_sync_entity_map AS m (
    company_id, entity_type, style_key, suite_id, sync_version, last_direction,
    field_snapshot, updated_at
  ) VALUES (
    p_company_id, p_entity_type, btrim(p_style_key), p_suite_id,
    COALESCE(p_sync_version, 0), p_direction, p_field_snapshot, now()
  )
  ON CONFLICT (company_id, entity_type, style_key) DO UPDATE SET
    suite_id = COALESCE(EXCLUDED.suite_id, m.suite_id),
    sync_version = GREATEST(m.sync_version, EXCLUDED.sync_version),
    last_direction = EXCLUDED.last_direction,
    field_snapshot = COALESCE(EXCLUDED.field_snapshot, m.field_snapshot),
    updated_at = now();
$$;

-- ---------------------------------------------------------------------------
-- Clientes: merge por campo (ventana conflicto 5 min)
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
  v_style_name text := btrim(concat_ws(' ', nullif(btrim(coalesce(p_nomcli, '')), ''), nullif(btrim(coalesce(p_ape1, '')), '')));
  v_customer_id uuid;
  v_row public.customers%ROWTYPE;
  v_baseline jsonb;
  v_merge jsonb;
  v_conflict_fields jsonb := '[]'::jsonb;
  v_style_ts timestamptz;
  v_suite_ts timestamptz;
  v_snapshot jsonb;
  v_final_name text;
  v_final_email text;
  v_final_tax_id text;
  v_final_dir text;
  v_final_codpos text;
  v_final_pob text;
  v_final_pro text;
  v_final_pais text;
  v_final_percon text;
  v_final_notes text;
  v_final_birth date;
  v_phone_home text;
  v_phone_mobile text;
  v_final_phone text;
  v_new_norm text;
  v_norm_owner uuid;
  v_apply_phones boolean := true;
  v_has_conflict boolean := false;
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

  IF v_style_name = '' THEN v_style_name := 'Cliente ' || v_codcli; END IF;

  v_phone_home := nullif(btrim(coalesce(p_tel1, '')), '');
  v_phone_mobile := nullif(btrim(coalesce(p_tel2, '')), '');
  v_final_phone := coalesce(v_phone_mobile, v_phone_home);

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      id, company_id, legacy_codcli, name, email, tax_id,
      address_street, address_postal_code, address_city, address_state, address_country,
      contact_person, notes, birth_date, phone_home, phone_mobile, phone
    ) VALUES (
      gen_random_uuid(), p_company_id, v_codcli, v_style_name,
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
      v_phone_home, v_phone_mobile, v_final_phone
    )
    RETURNING id INTO v_customer_id;

    v_snapshot := jsonb_build_object(
      'name', v_style_name,
      'email', coalesce(p_email, ''),
      'tax_id', coalesce(p_dni, ''),
      'address_street', coalesce(p_dir, ''),
      'address_postal_code', coalesce(p_codpos, ''),
      'address_city', coalesce(p_pob, ''),
      'address_state', coalesce(p_pro, ''),
      'address_country', coalesce(p_pais, 'España'),
      'contact_person', coalesce(p_percon, ''),
      'notes', coalesce(p_obs, ''),
      'birth_date', coalesce(to_char(p_fecnac, 'YYYY-MM-DD'), ''),
      'phone', coalesce(v_final_phone, ''),
      'phone_home', coalesce(v_phone_home, ''),
      'phone_mobile', coalesce(v_phone_mobile, '')
    );
    PERFORM dunasoft.style_map_upsert(
      p_company_id, 'customer', v_codcli, v_customer_id, p_sync_version, 'style_to_suite', v_snapshot
    );
    RETURN jsonb_build_object('ok', true, 'accion', 'UPSERT', 'codcli', v_codcli, 'customer_id', v_customer_id);
  END IF;

  SELECT * INTO v_row FROM public.customers WHERE id = v_customer_id;
  v_style_ts := coalesce(dunasoft.style_sync_ts_from_version(p_sync_version), now());
  v_suite_ts := v_row.updated_at;

  SELECT coalesce(m.field_snapshot, jsonb_build_object(
    'name', v_row.name,
    'email', coalesce(v_row.email, ''),
    'tax_id', coalesce(v_row.tax_id, ''),
    'address_street', coalesce(v_row.address_street, ''),
    'address_postal_code', coalesce(v_row.address_postal_code, ''),
    'address_city', coalesce(v_row.address_city, ''),
    'address_state', coalesce(v_row.address_state, ''),
    'address_country', coalesce(v_row.address_country, ''),
    'contact_person', coalesce(v_row.contact_person, ''),
    'notes', coalesce(v_row.notes, ''),
    'birth_date', coalesce(to_char(v_row.birth_date, 'YYYY-MM-DD'), ''),
    'phone', coalesce(v_row.phone, ''),
    'phone_home', coalesce(v_row.phone_home, ''),
    'phone_mobile', coalesce(v_row.phone_mobile, '')
  ))
  INTO v_baseline
  FROM dunasoft.style_sync_entity_map m
  WHERE m.company_id = p_company_id AND m.entity_type = 'customer' AND m.style_key = v_codcli;

  IF v_baseline IS NULL THEN
    v_baseline := jsonb_build_object(
      'name', v_row.name,
      'email', coalesce(v_row.email, ''),
      'tax_id', coalesce(v_row.tax_id, ''),
      'address_street', coalesce(v_row.address_street, ''),
      'address_postal_code', coalesce(v_row.address_postal_code, ''),
      'address_city', coalesce(v_row.address_city, ''),
      'address_state', coalesce(v_row.address_state, ''),
      'address_country', coalesce(v_row.address_country, ''),
      'contact_person', coalesce(v_row.contact_person, ''),
      'notes', coalesce(v_row.notes, ''),
      'birth_date', coalesce(to_char(v_row.birth_date, 'YYYY-MM-DD'), ''),
      'phone', coalesce(v_row.phone, ''),
      'phone_home', coalesce(v_row.phone_home, ''),
      'phone_mobile', coalesce(v_row.phone_mobile, '')
    );
  END IF;

  -- name
  v_merge := dunasoft.style_sync_merge_scalar(
    v_style_name, v_row.name, v_baseline->>'name', v_style_ts, v_suite_ts, true
  );
  v_final_name := coalesce(nullif(v_merge->>'value', ''), v_row.name);
  IF (v_merge->>'conflict')::boolean THEN
    v_conflict_fields := v_conflict_fields || jsonb_build_array(jsonb_build_object(
      'field', 'name', 'style', v_merge->>'style', 'suite', v_merge->>'suite'
    ));
  END IF;

  -- email
  v_merge := dunasoft.style_sync_merge_scalar(
    p_email, v_row.email, v_baseline->>'email', v_style_ts, v_suite_ts,
    nullif(btrim(coalesce(p_email, '')), '') IS NOT NULL
  );
  v_final_email := nullif(v_merge->>'value', '');
  IF (v_merge->>'conflict')::boolean THEN
    v_conflict_fields := v_conflict_fields || jsonb_build_array(jsonb_build_object(
      'field', 'email', 'style', v_merge->>'style', 'suite', v_merge->>'suite'
    ));
  END IF;

  -- tax_id
  v_merge := dunasoft.style_sync_merge_scalar(
    p_dni, v_row.tax_id, v_baseline->>'tax_id', v_style_ts, v_suite_ts,
    nullif(btrim(coalesce(p_dni, '')), '') IS NOT NULL
  );
  v_final_tax_id := nullif(v_merge->>'value', '');
  IF (v_merge->>'conflict')::boolean THEN
    v_conflict_fields := v_conflict_fields || jsonb_build_array(jsonb_build_object(
      'field', 'tax_id', 'style', v_merge->>'style', 'suite', v_merge->>'suite'
    ));
  END IF;

  -- address_street
  v_merge := dunasoft.style_sync_merge_scalar(
    p_dir, v_row.address_street, v_baseline->>'address_street', v_style_ts, v_suite_ts,
    nullif(btrim(coalesce(p_dir, '')), '') IS NOT NULL
  );
  v_final_dir := nullif(v_merge->>'value', '');
  IF (v_merge->>'conflict')::boolean THEN
    v_conflict_fields := v_conflict_fields || jsonb_build_array(jsonb_build_object(
      'field', 'address_street', 'style', v_merge->>'style', 'suite', v_merge->>'suite'
    ));
  END IF;

  v_merge := dunasoft.style_sync_merge_scalar(
    p_codpos, v_row.address_postal_code, v_baseline->>'address_postal_code', v_style_ts, v_suite_ts,
    nullif(btrim(coalesce(p_codpos, '')), '') IS NOT NULL
  );
  v_final_codpos := nullif(v_merge->>'value', '');

  v_merge := dunasoft.style_sync_merge_scalar(
    p_pob, v_row.address_city, v_baseline->>'address_city', v_style_ts, v_suite_ts,
    nullif(btrim(coalesce(p_pob, '')), '') IS NOT NULL
  );
  v_final_pob := nullif(v_merge->>'value', '');

  v_merge := dunasoft.style_sync_merge_scalar(
    p_pro, v_row.address_state, v_baseline->>'address_state', v_style_ts, v_suite_ts,
    nullif(btrim(coalesce(p_pro, '')), '') IS NOT NULL
  );
  v_final_pro := nullif(v_merge->>'value', '');

  v_merge := dunasoft.style_sync_merge_scalar(
    p_pais, v_row.address_country, v_baseline->>'address_country', v_style_ts, v_suite_ts,
    nullif(btrim(coalesce(p_pais, '')), '') IS NOT NULL
  );
  v_final_pais := coalesce(nullif(v_merge->>'value', ''), v_row.address_country, 'España');

  v_merge := dunasoft.style_sync_merge_scalar(
    p_percon, v_row.contact_person, v_baseline->>'contact_person', v_style_ts, v_suite_ts,
    nullif(btrim(coalesce(p_percon, '')), '') IS NOT NULL
  );
  v_final_percon := nullif(v_merge->>'value', '');

  -- notes / observaciones
  v_merge := dunasoft.style_sync_merge_scalar(
    p_obs, v_row.notes, v_baseline->>'notes', v_style_ts, v_suite_ts,
    nullif(btrim(coalesce(p_obs, '')), '') IS NOT NULL
  );
  v_final_notes := nullif(v_merge->>'value', '');
  IF (v_merge->>'conflict')::boolean THEN
    v_conflict_fields := v_conflict_fields || jsonb_build_array(jsonb_build_object(
      'field', 'notes', 'style', v_merge->>'style', 'suite', v_merge->>'suite'
    ));
  END IF;

  -- phone (teléfono principal)
  v_merge := dunasoft.style_sync_merge_scalar(
    v_final_phone, v_row.phone, v_baseline->>'phone', v_style_ts, v_suite_ts,
    v_final_phone IS NOT NULL
  );
  v_final_phone := nullif(v_merge->>'value', '');
  IF (v_merge->>'conflict')::boolean THEN
    v_conflict_fields := v_conflict_fields || jsonb_build_array(jsonb_build_object(
      'field', 'phone', 'style', v_merge->>'style', 'suite', v_merge->>'suite'
    ));
  END IF;

  -- birth_date: solo merge si Style envía fecha
  IF p_fecnac IS NOT NULL THEN
    v_merge := dunasoft.style_sync_merge_scalar(
      to_char(p_fecnac, 'YYYY-MM-DD'),
      to_char(v_row.birth_date, 'YYYY-MM-DD'),
      v_baseline->>'birth_date',
      v_style_ts, v_suite_ts, true
    );
    v_final_birth := nullif(v_merge->>'value', '')::date;
    IF (v_merge->>'conflict')::boolean THEN
      v_conflict_fields := v_conflict_fields || jsonb_build_array(jsonb_build_object(
        'field', 'birth_date', 'style', v_merge->>'style', 'suite', v_merge->>'suite'
      ));
    END IF;
  ELSE
    v_final_birth := v_row.birth_date;
  END IF;

  v_has_conflict := jsonb_array_length(v_conflict_fields) > 0;

  v_new_norm := public.customer_primary_phone_last9(
    v_final_phone, v_phone_mobile, v_phone_home
  );
  IF v_new_norm IS NOT NULL THEN
    SELECT c.id INTO v_norm_owner
    FROM public.customers c
    WHERE c.company_id = p_company_id AND c.phone_norm = v_new_norm
    LIMIT 1;
    IF v_norm_owner IS NOT NULL AND v_norm_owner IS DISTINCT FROM v_customer_id THEN
      v_apply_phones := false;
    END IF;
  END IF;

  UPDATE public.customers SET
    legacy_codcli = coalesce(nullif(btrim(legacy_codcli), ''), v_codcli),
    name = coalesce(v_final_name, name),
    email = v_final_email,
    tax_id = v_final_tax_id,
    address_street = v_final_dir,
    address_postal_code = v_final_codpos,
    address_city = v_final_pob,
    address_state = v_final_pro,
    address_country = v_final_pais,
    contact_person = v_final_percon,
    notes = v_final_notes,
    birth_date = v_final_birth,
    phone_home = CASE WHEN v_apply_phones THEN coalesce(v_phone_home, phone_home) ELSE phone_home END,
    phone_mobile = CASE WHEN v_apply_phones THEN coalesce(v_phone_mobile, phone_mobile) ELSE phone_mobile END,
    phone = CASE WHEN v_apply_phones THEN coalesce(v_final_phone, phone) ELSE phone END,
    style_sync_conflict_at = CASE WHEN v_has_conflict THEN now() ELSE NULL END,
    style_sync_conflict_fields = CASE WHEN v_has_conflict THEN v_conflict_fields ELSE NULL END,
    updated_at = now()
  WHERE id = v_customer_id;

  v_snapshot := jsonb_build_object(
    'name', coalesce(v_final_name, v_row.name),
    'email', coalesce(v_final_email, ''),
    'tax_id', coalesce(v_final_tax_id, ''),
    'address_street', coalesce(v_final_dir, ''),
    'address_postal_code', coalesce(v_final_codpos, ''),
    'address_city', coalesce(v_final_pob, ''),
    'address_state', coalesce(v_final_pro, ''),
    'address_country', coalesce(v_final_pais, 'España'),
    'contact_person', coalesce(v_final_percon, ''),
    'notes', coalesce(v_final_notes, ''),
    'birth_date', coalesce(to_char(v_final_birth, 'YYYY-MM-DD'), ''),
    'phone', coalesce(v_final_phone, ''),
    'phone_home', coalesce(v_phone_home, v_row.phone_home, ''),
    'phone_mobile', coalesce(v_phone_mobile, v_row.phone_mobile, '')
  );

  PERFORM dunasoft.style_map_upsert(
    p_company_id, 'customer', v_codcli, v_customer_id, p_sync_version, 'style_to_suite', v_snapshot
  );

  IF v_has_conflict THEN
    PERFORM dunasoft.style_sync_raise_conflict(
      p_company_id, 'customer', v_codcli, v_customer_id, v_conflict_fields,
      v_snapshot, v_baseline,
      'Mismo campo editado en Style y Suite casi a la vez (5 min). El resto de campos se fusionó.'
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'conflict', v_has_conflict,
    'partial_merge', v_has_conflict,
    'accion', 'UPSERT',
    'codcli', v_codcli,
    'customer_id', v_customer_id,
    'fields', v_conflict_fields
  );
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_sync_merge_scalar(text, text, text, timestamptz, timestamptz, boolean)
  TO service_role;
