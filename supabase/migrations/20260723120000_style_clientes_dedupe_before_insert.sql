-- Evita duplicados Style→Suite: antes de INSERT, resolver por teléfono / DNI / nombre único.
-- Caso típico: alta en Suite (codcli 100000xx) y luego Style sincroniza el mismo cliente con otro codcli.

CREATE OR REPLACE FUNCTION dunasoft.style_resolve_existing_customer(
  p_company_id uuid,
  p_codcli text,
  p_name text,
  p_tel1 text,
  p_tel2 text,
  p_dni text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_codcli text := btrim(coalesce(p_codcli, ''));
  v_name text := lower(btrim(coalesce(p_name, '')));
  v_dni text := upper(regexp_replace(btrim(coalesce(p_dni, '')), '[\s\-\.]', '', 'g'));
  v_phone_norm text;
  v_id uuid;
  v_n int;
BEGIN
  IF v_codcli = '' OR v_codcli = '0' THEN
    RETURN NULL;
  END IF;

  -- 1) Mapa Style explícito
  v_id := dunasoft.style_map_suite_id(p_company_id, 'customer', v_codcli);
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- 2) legacy_codcli (activo o no; preferir activo)
  SELECT c.id INTO v_id
  FROM public.customers c
  WHERE c.company_id = p_company_id
    AND public.legacy_codcli_to_bigint(c.legacy_codcli)
        = public.legacy_codcli_to_bigint(v_codcli)
  ORDER BY (c.archived_at IS NULL) DESC, c.updated_at DESC NULLS LAST
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- 3) Teléfono (9 dígitos) entre activos
  v_phone_norm := public.customer_primary_phone_last9(p_tel2, p_tel1, NULL);
  IF v_phone_norm IS NULL THEN
    v_phone_norm := public.customer_primary_phone_last9(p_tel1, p_tel2, NULL);
  END IF;
  IF v_phone_norm IS NOT NULL THEN
    SELECT c.id INTO v_id
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.archived_at IS NULL
      AND c.phone_norm = v_phone_norm
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  -- 4) DNI / tax_id normalizado (activo, match único)
  IF v_dni <> '' AND length(v_dni) >= 5 THEN
    SELECT count(*), min(c.id) INTO v_n, v_id
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.archived_at IS NULL
      AND upper(regexp_replace(btrim(coalesce(c.tax_id, '')), '[\s\-\.]', '', 'g')) = v_dni;
    IF v_n = 1 THEN
      RETURN v_id;
    END IF;
  END IF;

  -- 5) Nombre exacto (activo, match único) — evita "Maria" genérico (varios matches)
  IF v_name <> '' AND v_name NOT LIKE 'cliente %' AND length(v_name) >= 8 THEN
    SELECT count(*), min(c.id) INTO v_n, v_id
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.archived_at IS NULL
      AND lower(btrim(c.name)) = v_name;
    IF v_n = 1 THEN
      RETURN v_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION dunasoft.style_resolve_existing_customer(uuid, text, text, text, text, text) IS
  'Resuelve customer_id para Style→Suite: mapa, codcli, teléfono, DNI único, nombre único.';

GRANT EXECUTE ON FUNCTION dunasoft.style_resolve_existing_customer(uuid, text, text, text, text, text)
  TO service_role;

-- Parche del apply: usar el resolver y adoptar codcli Style si Suite tenía auto-codcli.
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
  p_sync_version bigint DEFAULT 0,
  p_altura     integer DEFAULT NULL
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
  v_final_height numeric;
  v_altura int;
  v_phone_home text;
  v_phone_mobile text;
  v_final_phone text;
  v_new_norm text;
  v_norm_owner uuid;
  v_apply_phones boolean := true;
  v_has_conflict boolean := false;
  v_linked_existing boolean := false;
BEGIN
  IF v_codcli = '' OR v_codcli = '0' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codcli vacío');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  v_altura := CASE
    WHEN p_altura IS NOT NULL AND p_altura BETWEEN 100 AND 230 THEN p_altura
    ELSE NULL
  END;

  IF v_style_name = '' THEN v_style_name := 'Cliente ' || v_codcli; END IF;

  v_phone_home := nullif(btrim(coalesce(p_tel1, '')), '');
  v_phone_mobile := nullif(btrim(coalesce(p_tel2, '')), '');
  v_final_phone := coalesce(v_phone_mobile, v_phone_home);

  v_customer_id := dunasoft.style_resolve_existing_customer(
    p_company_id, v_codcli, v_style_name, v_phone_home, v_phone_mobile, p_dni
  );
  IF v_customer_id IS NOT NULL THEN
    -- Si venía de teléfono/nombre/DNI (no solo mapa/codcli), marcar vínculo
    v_linked_existing := NOT EXISTS (
      SELECT 1 FROM public.customers c
      WHERE c.id = v_customer_id
        AND public.legacy_codcli_to_bigint(c.legacy_codcli)
            = public.legacy_codcli_to_bigint(v_codcli)
    );
  END IF;

  IF v_accion IN ('DELETE', 'BAJA', 'BORRAR') THEN
    IF v_customer_id IS NOT NULL THEN
      PERFORM dunasoft.style_map_upsert(p_company_id, 'customer', v_codcli, v_customer_id, p_sync_version, 'style_to_suite');
    END IF;
    RETURN jsonb_build_object('ok', true, 'accion', 'DELETE', 'codcli', v_codcli, 'customer_id', v_customer_id);
  END IF;

  -- Espejo dunasoft.clientes.altura (si la fila existe)
  UPDATE dunasoft.clientes
  SET altura = coalesce(v_altura, altura)
  WHERE btrim(codcli) = v_codcli
     OR ltrim(btrim(codcli), '0') = ltrim(v_codcli, '0');

  IF v_customer_id IS NULL THEN
    -- No insertar teléfonos si ya hay otro activo con el mismo phone_norm
    v_new_norm := public.customer_primary_phone_last9(v_final_phone, v_phone_mobile, v_phone_home);
    IF v_new_norm IS NOT NULL THEN
      SELECT c.id INTO v_norm_owner
      FROM public.customers c
      WHERE c.company_id = p_company_id
        AND c.archived_at IS NULL
        AND c.phone_norm = v_new_norm
      LIMIT 1;
      IF v_norm_owner IS NOT NULL THEN
        v_customer_id := v_norm_owner;
        v_linked_existing := true;
      END IF;
    END IF;
  END IF;

  IF v_customer_id IS NULL THEN
    INSERT INTO public.customers (
      id, company_id, legacy_codcli, name, email, tax_id,
      address_street, address_postal_code, address_city, address_state, address_country,
      contact_person, notes, birth_date, height_cm, phone_home, phone_mobile, phone
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
      v_altura::numeric,
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
      'height_cm', coalesce(v_altura::text, ''),
      'phone', coalesce(v_final_phone, ''),
      'phone_home', coalesce(v_phone_home, ''),
      'phone_mobile', coalesce(v_phone_mobile, '')
    );
    PERFORM dunasoft.style_map_upsert(
      p_company_id, 'customer', v_codcli, v_customer_id, p_sync_version, 'style_to_suite', v_snapshot
    );
    RETURN jsonb_build_object('ok', true, 'accion', 'UPSERT', 'codcli', v_codcli, 'customer_id', v_customer_id);
  END IF;

  -- Adoptar codcli Style si Suite tenía auto-codcli (>=10M) o vacío
  UPDATE public.customers c
  SET legacy_codcli = v_codcli,
      updated_at = now()
  WHERE c.id = v_customer_id
    AND (
      nullif(btrim(coalesce(c.legacy_codcli, '')), '') IS NULL
      OR public.legacy_codcli_to_bigint(c.legacy_codcli) >= 10000000
      OR public.legacy_codcli_to_bigint(c.legacy_codcli)
           = public.legacy_codcli_to_bigint(v_codcli)
    );

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
    'height_cm', coalesce(round(v_row.height_cm)::text, ''),
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
      'height_cm', coalesce(round(v_row.height_cm)::text, ''),
      'phone', coalesce(v_row.phone, ''),
      'phone_home', coalesce(v_row.phone_home, ''),
      'phone_mobile', coalesce(v_row.phone_mobile, '')
    );
  END IF;

  v_merge := dunasoft.style_sync_merge_scalar(
    v_style_name, v_row.name, v_baseline->>'name', v_style_ts, v_suite_ts, true
  );
  v_final_name := coalesce(nullif(v_merge->>'value', ''), v_row.name);
  IF (v_merge->>'conflict')::boolean THEN
    v_conflict_fields := v_conflict_fields || jsonb_build_array(jsonb_build_object(
      'field', 'name', 'style', v_merge->>'style', 'suite', v_merge->>'suite'
    ));
  END IF;

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

  IF v_altura IS NOT NULL THEN
    v_merge := dunasoft.style_sync_merge_scalar(
      v_altura::text,
      CASE WHEN v_row.height_cm IS NULL THEN '' ELSE round(v_row.height_cm)::text END,
      v_baseline->>'height_cm',
      v_style_ts, v_suite_ts, true
    );
    v_final_height := nullif(v_merge->>'value', '')::numeric;
    IF (v_merge->>'conflict')::boolean THEN
      v_conflict_fields := v_conflict_fields || jsonb_build_array(jsonb_build_object(
        'field', 'height_cm', 'style', v_merge->>'style', 'suite', v_merge->>'suite'
      ));
    END IF;
  ELSE
    v_final_height := v_row.height_cm;
  END IF;

  v_has_conflict := jsonb_array_length(v_conflict_fields) > 0;

  v_new_norm := public.customer_primary_phone_last9(
    v_final_phone, v_phone_mobile, v_phone_home
  );
  IF v_new_norm IS NOT NULL THEN
    SELECT c.id INTO v_norm_owner
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.archived_at IS NULL
      AND c.phone_norm = v_new_norm
    LIMIT 1;
    IF v_norm_owner IS NOT NULL AND v_norm_owner IS DISTINCT FROM v_customer_id THEN
      v_apply_phones := false;
    END IF;
  END IF;

  UPDATE public.customers SET
    legacy_codcli = CASE
      WHEN nullif(btrim(coalesce(legacy_codcli, '')), '') IS NULL THEN v_codcli
      WHEN public.legacy_codcli_to_bigint(legacy_codcli) >= 10000000 THEN v_codcli
      WHEN public.legacy_codcli_to_bigint(legacy_codcli)
             = public.legacy_codcli_to_bigint(v_codcli) THEN v_codcli
      ELSE legacy_codcli
    END,
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
    height_cm = v_final_height,
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
    'height_cm', coalesce(round(v_final_height)::text, ''),
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
    'linked_existing', v_linked_existing,
    'accion', 'UPSERT',
    'codcli', v_codcli,
    'customer_id', v_customer_id,
    'fields', v_conflict_fields
  );
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_clientes_apply_from_style(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, date, boolean, bigint, integer
) TO service_role;
