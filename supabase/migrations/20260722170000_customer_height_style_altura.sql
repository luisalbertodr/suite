-- Vincula public.customers.height_cm ↔ dunasoft.clientes.altura (Style/Dunasoft).
-- Style→Suite: p_altura; Suite→Style: payload.altura

DROP FUNCTION IF EXISTS dunasoft.style_clientes_apply_from_style(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, date, boolean, bigint
);

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
BEGIN
  IF v_codcli = '' OR v_codcli = '0' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codcli vacío');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  v_altura := CASE
    WHEN p_altura IS NOT NULL AND p_altura BETWEEN 100 AND 230 THEN p_altura
    ELSE NULL
  END;

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

  -- Espejo dunasoft.clientes.altura (si la fila existe)
  UPDATE dunasoft.clientes
  SET altura = coalesce(v_altura, altura)
  WHERE btrim(codcli) = v_codcli
     OR ltrim(btrim(codcli), '0') = ltrim(v_codcli, '0');

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

  -- altura ↔ height_cm
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

-- Suite → Style: incluir altura (cm enteros, como en Style)
CREATE OR REPLACE FUNCTION public.customers_enqueue_style_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_op text;
  v_split record;
  v_full_name text;
  v_altura int;
BEGIN
  IF current_setting('dunasoft.in_style_apply', true) = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NOT dunasoft.suite_to_style_enabled('clientes') THEN
    RETURN NEW;
  END IF;

  v_op := CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END;
  v_full_name := public.repair_customer_text(NEW.name);
  SELECT * INTO v_split FROM public.split_customer_display_name(v_full_name);
  v_altura := CASE
    WHEN NEW.height_cm IS NOT NULL AND NEW.height_cm BETWEEN 100 AND 230
      THEN round(NEW.height_cm)::int
    ELSE NULL
  END;

  PERFORM dunasoft.enqueue_style_entity(
    NEW.company_id, 'customer', v_op, NEW.legacy_codcli, NEW.id,
    jsonb_build_object(
      'codcli', NEW.legacy_codcli,
      'nomcli', coalesce(v_split.nomcli, ''),
      'ape1cli', coalesce(v_split.ape1cli, ''),
      'tel1cli', coalesce(NEW.phone_home, NEW.phone, ''),
      'tel2cli', coalesce(NEW.phone_mobile, ''),
      'email', coalesce(NEW.email, ''),
      'dnicli', coalesce(NEW.tax_id, ''),
      'dircli', coalesce(public.repair_customer_text(NEW.address_street), ''),
      'codposcli', coalesce(NEW.address_postal_code, ''),
      'pobcli', coalesce(public.repair_customer_text(NEW.address_city), ''),
      'procli', coalesce(public.repair_customer_text(NEW.address_state), ''),
      'pais', coalesce(public.repair_customer_text(NEW.address_country), ''),
      'percon', coalesce(public.repair_customer_text(NEW.contact_person), ''),
      'obscli', coalesce(public.repair_customer_text(NEW.notes), ''),
      'fecnac', coalesce(to_char(NEW.birth_date, 'YYYY-MM-DD'), ''),
      'altura', v_altura
    )
  );
  RETURN NEW;
END;
$$;

-- Backfill: Dunasoft → Suite (si Suite no tiene altura)
UPDATE public.customers c
SET height_cm = d.altura::numeric,
    updated_at = now()
FROM dunasoft.clientes d
WHERE c.height_cm IS NULL
  AND d.altura IS NOT NULL
  AND d.altura BETWEEN 100 AND 230
  AND (
    btrim(c.legacy_codcli) = btrim(d.codcli)
    OR ltrim(btrim(c.legacy_codcli), '0') = ltrim(btrim(d.codcli), '0')
  );

-- Backfill: Suite → espejo Dunasoft
UPDATE dunasoft.clientes d
SET altura = round(c.height_cm)::int
FROM public.customers c
WHERE c.height_cm IS NOT NULL
  AND c.height_cm BETWEEN 100 AND 230
  AND (
    btrim(c.legacy_codcli) = btrim(d.codcli)
    OR ltrim(btrim(c.legacy_codcli), '0') = ltrim(btrim(d.codcli), '0')
  )
  AND (d.altura IS NULL OR d.altura IS DISTINCT FROM round(c.height_cm)::int);
