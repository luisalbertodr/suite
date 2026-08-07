-- Yolanda Novoa Reyes: ficha era CLIENTE CONTADO (HOMBRE) con su DNI/tel.
-- Prevencion: renombrar fichas genericas Style al nombre real de la cita.

CREATE OR REPLACE FUNCTION public.is_generic_style_customer_name(p_name text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT coalesce(p_name, '') ~* '^cliente[[:space:]]+contado'
      OR coalesce(p_name, '') ~* '^cliente[[:space:]]+[0-9]{3,}$';
$$;

COMMENT ON FUNCTION public.is_generic_style_customer_name(text) IS
  'True si el nombre es generico Style (CLIENTE CONTADO / Cliente 001234).';

CREATE OR REPLACE FUNCTION dunasoft.ensure_customer_for_style_codcli(p_company_id uuid, p_codcli text, p_nomcli text DEFAULT NULL::text, p_tel1 text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'dunasoft', 'public'
AS $function$
DECLARE
  v_codcli text := btrim(coalesce(p_codcli, ''));
  v_nomcli text := nullif(btrim(coalesce(p_nomcli, '')), '');
  v_tel text := nullif(btrim(coalesce(p_tel1, '')), '');
  v_customer_id uuid;
  v_name text;
  v_is_ph boolean;
  v_cli dunasoft.clientes%ROWTYPE;
  v_style_name text;
  v_phone_home text;
  v_phone_mobile text;
  v_phone text;
  v_email text;
  v_dni text;
  v_dir text;
  v_codpos text;
  v_pob text;
  v_pro text;
  v_pais text;
  v_birth date;
  v_real_id uuid;
  v_real_name text;
  v_mapped uuid;
  v_is_generic boolean;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN NULL;
  END IF;
  IF v_codcli = '' OR v_codcli = '0' OR v_codcli ~ '^0+$' THEN
    RETURN NULL;
  END IF;

  -- 0) Si el nombre Style es placeholder InBody, intentar recuperar ficha real
  IF public.is_inbody_placeholder_customer_name(coalesce(v_nomcli, '')) THEN
    SELECT r.customer_id, r.display_name
    INTO v_real_id, v_real_name
    FROM public.recover_real_customer_for_inbody_style(p_company_id, v_codcli, v_tel) r
    LIMIT 1;
    IF v_real_id IS NOT NULL THEN
      PERFORM dunasoft.style_map_upsert(
        p_company_id, 'customer', v_codcli, v_real_id, 0, 'style_to_suite', NULL
      );
      IF v_tel IS NOT NULL THEN
        BEGIN
          UPDATE public.customers
          SET phone_mobile = coalesce(nullif(btrim(phone_mobile), ''), v_tel),
              phone = coalesce(nullif(btrim(phone), ''), v_tel),
              updated_at = now()
          WHERE id = v_real_id
            AND coalesce(nullif(btrim(phone_mobile), ''), nullif(btrim(phone), '')) IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM public.customers o
              WHERE o.company_id = p_company_id
                AND o.id IS DISTINCT FROM v_real_id
                AND o.archived_at IS NULL
                AND o.phone_norm IS NOT NULL
                AND o.phone_norm = regexp_replace(v_tel, '\D', '', 'g')
            );
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
      END IF;
      RETURN v_real_id;
    END IF;
  END IF;

  -- 1a) Mapa Style→Suite hacia ficha real
  v_mapped := dunasoft.style_map_suite_id(p_company_id, 'customer', v_codcli);
  IF v_mapped IS NOT NULL THEN
    SELECT c.id, c.name,
           public.is_inbody_placeholder_customer_name(c.name),
           public.is_generic_style_customer_name(c.name)
    INTO v_customer_id, v_name, v_is_ph, v_is_generic
    FROM public.customers c
    WHERE c.id = v_mapped
      AND c.company_id = p_company_id
      AND c.archived_at IS NULL;
    IF v_customer_id IS NOT NULL AND NOT coalesce(v_is_ph, false) THEN
      IF coalesce(v_is_generic, false)
         AND v_nomcli IS NOT NULL
         AND NOT public.is_inbody_placeholder_customer_name(v_nomcli)
         AND NOT public.is_generic_style_customer_name(v_nomcli)
         AND lower(btrim(v_name)) IS DISTINCT FROM lower(btrim(v_nomcli)) THEN
        UPDATE public.customers
        SET name = v_nomcli, updated_at = now()
        WHERE id = v_customer_id;
        v_name := v_nomcli;
      END IF;
      IF v_tel IS NOT NULL THEN
        BEGIN
          UPDATE public.customers
          SET phone_mobile = coalesce(nullif(btrim(phone_mobile), ''), v_tel),
              phone = coalesce(nullif(btrim(phone), ''), v_tel),
              updated_at = now()
          WHERE id = v_customer_id
            AND coalesce(nullif(btrim(phone_mobile), ''), nullif(btrim(phone), '')) IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM public.customers o
              WHERE o.company_id = p_company_id
                AND o.id IS DISTINCT FROM v_customer_id
                AND o.archived_at IS NULL
                AND o.phone_norm IS NOT NULL
                AND o.phone_norm = regexp_replace(v_tel, '\D', '', 'g')
            );
        EXCEPTION WHEN unique_violation THEN
          NULL;
        END;
      END IF;
      PERFORM dunasoft.style_map_upsert(
        p_company_id, 'customer', v_codcli, v_customer_id, 0, 'style_to_suite', NULL
      );
      RETURN v_customer_id;
    END IF;
  END IF;

  -- 1b) Cliente Suite existente por legacy_codcli (preferir no-placeholder)
  SELECT c.id, c.name,
         public.is_inbody_placeholder_customer_name(c.name),
         public.is_generic_style_customer_name(c.name)
  INTO v_customer_id, v_name, v_is_ph, v_is_generic
  FROM public.customers c
  WHERE c.company_id = p_company_id
    AND c.archived_at IS NULL
    AND NULLIF(btrim(c.legacy_codcli), '') IS NOT NULL
    AND (
      btrim(c.legacy_codcli) = v_codcli
      OR public.legacy_codcli_to_bigint(c.legacy_codcli) = public.legacy_codcli_to_bigint(v_codcli)
    )
  ORDER BY
    CASE WHEN public.is_inbody_placeholder_customer_name(c.name) THEN 1 ELSE 0 END,
    CASE WHEN public.is_generic_style_customer_name(c.name) THEN 1 ELSE 0 END,
    c.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_customer_id IS NOT NULL AND NOT coalesce(v_is_ph, false) THEN
    IF coalesce(v_is_generic, false)
       AND v_nomcli IS NOT NULL
       AND NOT public.is_inbody_placeholder_customer_name(v_nomcli)
       AND NOT public.is_generic_style_customer_name(v_nomcli)
       AND lower(btrim(v_name)) IS DISTINCT FROM lower(btrim(v_nomcli)) THEN
      UPDATE public.customers
      SET name = v_nomcli, updated_at = now()
      WHERE id = v_customer_id;
      v_name := v_nomcli;
    END IF;
    IF v_tel IS NOT NULL THEN
      BEGIN
        UPDATE public.customers
        SET phone_mobile = coalesce(nullif(btrim(phone_mobile), ''), v_tel),
            phone = coalesce(nullif(btrim(phone), ''), v_tel),
            updated_at = now()
        WHERE id = v_customer_id
          AND coalesce(nullif(btrim(phone_mobile), ''), nullif(btrim(phone), '')) IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM public.customers o
            WHERE o.company_id = p_company_id
              AND o.id IS DISTINCT FROM v_customer_id
              AND o.archived_at IS NULL
              AND o.phone_norm IS NOT NULL
              AND o.phone_norm = regexp_replace(v_tel, '\D', '', 'g')
          );
      EXCEPTION WHEN unique_violation THEN
        NULL;
      END;
    END IF;
    PERFORM dunasoft.style_map_upsert(
      p_company_id, 'customer', v_codcli, v_customer_id, 0, 'style_to_suite', NULL
    );
    RETURN v_customer_id;
  END IF;

  -- Datos Style (espejo PG si existe; si no, lo que venga de la cita)
  SELECT * INTO v_cli
  FROM dunasoft.clientes d
  WHERE btrim(d.codcli) = v_codcli
     OR public.legacy_codcli_to_bigint(d.codcli) = public.legacy_codcli_to_bigint(v_codcli)
  LIMIT 1;

  IF FOUND THEN
    v_style_name := btrim(concat_ws(
      ' ',
      nullif(btrim(coalesce(v_cli.nomcli, '')), ''),
      nullif(btrim(coalesce(v_cli.ape1cli, '')), '')
    ));
    v_phone_home := nullif(btrim(coalesce(v_cli.tel1cli, '')), '');
    v_phone_mobile := nullif(btrim(coalesce(v_cli.tel2cli, '')), '');
    v_email := nullif(btrim(coalesce(v_cli.email, '')), '');
    v_dni := nullif(btrim(coalesce(v_cli.dnicli, '')), '');
    v_dir := nullif(btrim(coalesce(v_cli.dircli, '')), '');
    v_codpos := nullif(btrim(coalesce(v_cli.codposcli, '')), '');
    v_pob := nullif(btrim(coalesce(v_cli.pobcli, '')), '');
    v_pro := nullif(btrim(coalesce(v_cli.procli, '')), '');
    v_pais := nullif(btrim(coalesce(v_cli.pais, '')), '');
    v_birth := v_cli.fecnac;
  END IF;

  IF v_style_name IS NULL OR v_style_name = '' THEN
    v_style_name := coalesce(v_nomcli, 'Cliente ' || v_codcli);
  END IF;
  IF public.is_inbody_placeholder_customer_name(v_style_name) AND v_nomcli IS NOT NULL
     AND NOT public.is_inbody_placeholder_customer_name(v_nomcli) THEN
    v_style_name := v_nomcli;
  END IF;

  v_phone_mobile := coalesce(v_phone_mobile, v_tel);
  v_phone_home := coalesce(v_phone_home, CASE WHEN v_tel IS NOT NULL AND v_phone_mobile IS DISTINCT FROM v_tel THEN v_tel ELSE NULL END);
  v_phone := coalesce(v_phone_mobile, v_phone_home);

  -- 2) Si hay nombre real: preferir ficha real homónima antes de promover placeholder
  IF v_style_name IS NOT NULL
     AND NOT public.is_inbody_placeholder_customer_name(v_style_name) THEN
    SELECT c.id, c.name
    INTO v_real_id, v_real_name
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.archived_at IS NULL
      AND NOT public.is_inbody_placeholder_customer_name(c.name)
      AND lower(btrim(c.name)) = lower(btrim(v_style_name))
    ORDER BY
      CASE WHEN nullif(btrim(c.tax_id), '') IS NOT NULL THEN 0 ELSE 1 END,
      CASE
        WHEN NULLIF(btrim(c.legacy_codcli), '') IS NOT NULL
         AND (
           btrim(c.legacy_codcli) = v_codcli
           OR public.legacy_codcli_to_bigint(c.legacy_codcli) = public.legacy_codcli_to_bigint(v_codcli)
         ) THEN 0
        ELSE 1
      END,
      c.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_real_id IS NOT NULL THEN
      -- Quitar codcli del placeholder para que no vuelva a capturar citas
      IF v_customer_id IS NOT NULL AND coalesce(v_is_ph, false) AND v_customer_id IS DISTINCT FROM v_real_id THEN
        UPDATE public.customers
        SET legacy_codcli = NULL,
            updated_at = now()
        WHERE id = v_customer_id
          AND public.is_inbody_placeholder_customer_name(name);
        -- Reasignar mediciones InBody del placeholder a la ficha real si el DNI coincide
        UPDATE public.inbody_measurements im
        SET customer_id = v_real_id,
            updated_at = now()
        WHERE im.customer_id = v_customer_id
          AND (
            nullif(btrim((SELECT tax_id FROM public.customers WHERE id = v_real_id)), '') IS NULL
            OR regexp_replace(upper(coalesce(im.inbody_user_id, '')), '[^A-Z0-9]', '', 'g')
               = regexp_replace(upper(coalesce((SELECT tax_id FROM public.customers WHERE id = v_real_id), '')), '[^A-Z0-9]', '', 'g')
          );
      END IF;

      PERFORM dunasoft.style_map_upsert(
        p_company_id, 'customer', v_codcli, v_real_id, 0, 'style_to_suite', NULL
      );
      RETURN v_real_id;
    END IF;
  END IF;

  -- 3) Promover placeholder InBody al nombre Style (solo si no hay ficha real)
  IF v_customer_id IS NOT NULL AND coalesce(v_is_ph, false)
     AND v_style_name IS NOT NULL
     AND NOT public.is_inbody_placeholder_customer_name(v_style_name) THEN
    BEGIN
      UPDATE public.customers SET
        name = v_style_name,
        phone_mobile = coalesce(nullif(btrim(phone_mobile), ''), v_phone_mobile),
        phone_home = coalesce(nullif(btrim(phone_home), ''), v_phone_home),
        phone = coalesce(nullif(btrim(phone), ''), v_phone),
        email = coalesce(nullif(btrim(email), ''), v_email),
        -- No pisar tax_id InBody con vacío; no importar DNI Style si ya hay uno
        tax_id = coalesce(nullif(btrim(tax_id), ''), v_dni),
        address_street = coalesce(nullif(btrim(address_street), ''), v_dir),
        address_postal_code = coalesce(nullif(btrim(address_postal_code), ''), v_codpos),
        address_city = coalesce(nullif(btrim(address_city), ''), v_pob),
        address_state = coalesce(nullif(btrim(address_state), ''), v_pro),
        address_country = coalesce(nullif(btrim(address_country), ''), v_pais, 'España'),
        birth_date = coalesce(birth_date, v_birth),
        legacy_codcli = coalesce(nullif(btrim(legacy_codcli), ''), v_codcli),
        updated_at = now()
      WHERE id = v_customer_id;
    EXCEPTION WHEN unique_violation THEN
      UPDATE public.customers SET
        name = v_style_name,
        legacy_codcli = coalesce(nullif(btrim(legacy_codcli), ''), v_codcli),
        updated_at = now()
      WHERE id = v_customer_id;
    END;
    PERFORM dunasoft.style_map_upsert(
      p_company_id, 'customer', v_codcli, v_customer_id, 0, 'style_to_suite', NULL
    );
    RETURN v_customer_id;
  END IF;

  IF v_customer_id IS NOT NULL THEN
    PERFORM dunasoft.style_map_upsert(
      p_company_id, 'customer', v_codcli, v_customer_id, 0, 'style_to_suite', NULL
    );
    RETURN v_customer_id;
  END IF;

  -- 4) Alta mínima. Si el nombre sigue siendo Paciente InBody, crear sin
  --    reclamar un legacy_codcli Style (evita secuestro de codcli reales).
  BEGIN
    INSERT INTO public.customers (
      id, company_id, legacy_codcli, name, email, tax_id,
      address_street, address_postal_code, address_city, address_state, address_country,
      phone_home, phone_mobile, phone, birth_date
    ) VALUES (
      gen_random_uuid(),
      p_company_id,
      CASE
        WHEN public.is_inbody_placeholder_customer_name(v_style_name) THEN NULL
        ELSE v_codcli
      END,
      v_style_name,
      v_email,
      CASE
        WHEN public.is_inbody_placeholder_customer_name(v_style_name) THEN
          -- conservar DNI del USERID InBody embebido en el nombre si no hay otro
          coalesce(v_dni, nullif(substring(v_style_name from '(?i)in[[:space:]]*body[[:space:]]+([A-Z0-9]+)'), ''))
        ELSE v_dni
      END,
      v_dir, v_codpos, v_pob, v_pro,
      coalesce(v_pais, 'España'),
      v_phone_home, v_phone_mobile, v_phone, v_birth
    )
    RETURNING id INTO v_customer_id;
  EXCEPTION WHEN unique_violation THEN
    INSERT INTO public.customers (
      id, company_id, legacy_codcli, name, email, tax_id,
      address_street, address_postal_code, address_city, address_state, address_country,
      birth_date
    ) VALUES (
      gen_random_uuid(),
      p_company_id,
      CASE
        WHEN public.is_inbody_placeholder_customer_name(v_style_name) THEN NULL
        ELSE v_codcli
      END,
      v_style_name,
      v_email, NULL, v_dir, v_codpos, v_pob, v_pro,
      coalesce(v_pais, 'España'),
      v_birth
    )
    RETURNING id INTO v_customer_id;
  END;

  -- Solo mapear Style→Suite si no es placeholder puro
  IF NOT public.is_inbody_placeholder_customer_name(v_style_name) THEN
    PERFORM dunasoft.style_map_upsert(
      p_company_id, 'customer', v_codcli, v_customer_id, 0, 'style_to_suite', NULL
    );
  END IF;

  RETURN v_customer_id;
END;
$function$;

-- Reparacion: fichas genericas con un unico nombre real en citas
WITH candidates AS (
  SELECT c.id AS customer_id,
         mode() WITHIN GROUP (ORDER BY a.client_name) AS real_name
  FROM public.customers c
  JOIN public.agenda_appointments a ON a.customer_id = c.id
  WHERE c.archived_at IS NULL
    AND public.is_generic_style_customer_name(c.name)
    AND NOT public.is_generic_style_customer_name(a.client_name)
    AND NOT public.is_inbody_placeholder_customer_name(a.client_name)
    AND nullif(btrim(a.client_name), '') IS NOT NULL
    AND a.client_name !~* 'firmar|consentimiento'
    AND a.appointment_date >= CURRENT_DATE - 400
  GROUP BY c.id
  HAVING count(DISTINCT lower(btrim(a.client_name))) = 1
)
UPDATE public.customers c
SET name = candidates.real_name,
    updated_at = now()
FROM candidates
WHERE c.id = candidates.customer_id
  AND public.is_generic_style_customer_name(c.name);
