-- Repara citas/fichas "Paciente InBody …" que sustituyeron a clientas reales
-- (caso Lucía Vizcaíno Vazquez DNI 33350716A ↔ InBody 32830031S) y endurece
-- ensure_customer / style_reservas para que no vuelva a ocurrir.

CREATE OR REPLACE FUNCTION public.recover_real_customer_for_inbody_style(
  p_company_id uuid,
  p_codcli text,
  p_tel text DEFAULT NULL
)
RETURNS TABLE(customer_id uuid, display_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_codcli text := nullif(btrim(coalesce(p_codcli, '')), '');
  v_tel_digits text := nullif(regexp_replace(coalesce(p_tel, ''), '\D', '', 'g'), '');
  v_mapped uuid;
  v_id uuid;
  v_name text;
BEGIN
  IF p_company_id IS NULL THEN
    RETURN;
  END IF;

  -- 1) Mapa Style→Suite ya corregido hacia ficha real
  IF v_codcli IS NOT NULL AND v_codcli NOT IN ('0') AND v_codcli !~ '^0+$' THEN
    v_mapped := dunasoft.style_map_suite_id(p_company_id, 'customer', v_codcli);
    IF v_mapped IS NOT NULL THEN
      SELECT c.id, c.name
      INTO v_id, v_name
      FROM public.customers c
      WHERE c.id = v_mapped
        AND c.company_id = p_company_id
        AND c.archived_at IS NULL
        AND NOT public.is_inbody_placeholder_customer_name(c.name);
      IF v_id IS NOT NULL THEN
        customer_id := v_id;
        display_name := v_name;
        RETURN NEXT;
        RETURN;
      END IF;
    END IF;

    -- 2) Ficha real con ese legacy_codcli
    SELECT c.id, c.name
    INTO v_id, v_name
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.archived_at IS NULL
      AND NOT public.is_inbody_placeholder_customer_name(c.name)
      AND NULLIF(btrim(c.legacy_codcli), '') IS NOT NULL
      AND (
        btrim(c.legacy_codcli) = v_codcli
        OR public.legacy_codcli_to_bigint(c.legacy_codcli) = public.legacy_codcli_to_bigint(v_codcli)
      )
    ORDER BY c.updated_at DESC NULLS LAST
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      customer_id := v_id;
      display_name := v_name;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  -- 3) Teléfono de la cita → ficha real
  IF v_tel_digits IS NOT NULL AND length(v_tel_digits) >= 9 THEN
    SELECT c.id, c.name
    INTO v_id, v_name
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.archived_at IS NULL
      AND NOT public.is_inbody_placeholder_customer_name(c.name)
      AND (
        c.phone_norm = v_tel_digits
        OR regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_tel_digits
        OR regexp_replace(coalesce(c.phone_mobile, ''), '\D', '', 'g') = v_tel_digits
        OR regexp_replace(coalesce(c.phone_home, ''), '\D', '', 'g') = v_tel_digits
      )
    ORDER BY
      CASE WHEN nullif(btrim(c.tax_id), '') IS NOT NULL THEN 0 ELSE 1 END,
      c.updated_at DESC NULLS LAST
    LIMIT 1;
    IF v_id IS NOT NULL THEN
      customer_id := v_id;
      display_name := v_name;
      RETURN NEXT;
      RETURN;
    END IF;
  END IF;

  RETURN;
END;
$$;

COMMENT ON FUNCTION public.recover_real_customer_for_inbody_style(uuid, text, text) IS
  'Cuando Style manda Paciente InBody …, recupera ficha real por mapa/codcli/teléfono.';

CREATE OR REPLACE FUNCTION dunasoft.ensure_customer_for_style_codcli(
  p_company_id uuid,
  p_codcli text,
  p_nomcli text DEFAULT NULL,
  p_tel1 text DEFAULT NULL
)
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
    SELECT c.id, c.name, public.is_inbody_placeholder_customer_name(c.name)
    INTO v_customer_id, v_name, v_is_ph
    FROM public.customers c
    WHERE c.id = v_mapped
      AND c.company_id = p_company_id
      AND c.archived_at IS NULL;
    IF v_customer_id IS NOT NULL AND NOT coalesce(v_is_ph, false) THEN
      PERFORM dunasoft.style_map_upsert(
        p_company_id, 'customer', v_codcli, v_customer_id, 0, 'style_to_suite', NULL
      );
      RETURN v_customer_id;
    END IF;
  END IF;

  -- 1b) Cliente Suite existente por legacy_codcli (preferir no-placeholder)
  SELECT c.id, c.name, public.is_inbody_placeholder_customer_name(c.name)
  INTO v_customer_id, v_name, v_is_ph
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
    c.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_customer_id IS NOT NULL AND NOT coalesce(v_is_ph, false) THEN
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

-- style_reservas_apply: recuperar nombre real antes de ensure/persistir
CREATE OR REPLACE FUNCTION dunasoft.style_reservas_apply_from_style(
  p_company_id uuid,
  p_accion text,
  p_idplan numeric,
  p_codemp text,
  p_codcli text,
  p_fecha date,
  p_horini text,
  p_horfin text,
  p_texto text,
  p_codrec text,
  p_nomcli text,
  p_tel1cli text,
  p_facturado boolean,
  p_servicios text,
  p_colfon numeric,
  p_collet numeric,
  p_style_modified_at text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'dunasoft', 'public'
AS $function$
DECLARE
  v_accion text := upper(btrim(coalesce(p_accion, '')));
  v_appt_id uuid;
  v_appt_company_id uuid;
  v_employee_id uuid;
  v_codemp text;
  v_codcli text;
  v_nomcli text;
  v_existing record;
  v_cancelled integer;
  v_codrec text := btrim(coalesce(p_codrec, ''));
  v_customer_id uuid;
  v_recovered_name text;
BEGIN
  PERFORM set_config('app.style_sync_inbound', '1', true);

  v_cancelled := dunasoft.cancel_pending_style_reservas_outbound(p_idplan);

  IF v_accion IN ('BAJA', 'BORRAR', 'DELETE') THEN
    SELECT a.id, a.company_id INTO v_appt_id, v_appt_company_id
    FROM public.agenda_appointments a
    JOIN public.agenda_dunasoft_bridge b
      ON b.agenda_appointment_id = a.id
     AND b.company_id = p_company_id
     AND b.legacy_idplan = p_idplan::text
    ORDER BY CASE WHEN a.company_id = p_company_id THEN 0 ELSE 1 END
    LIMIT 1;

    IF v_appt_id IS NULL THEN
      SELECT a.id, a.company_id INTO v_appt_id, v_appt_company_id
      FROM public.agenda_appointments a
      WHERE a.legacy_idplan = p_idplan::text
      ORDER BY CASE WHEN a.company_id = p_company_id THEN 0 ELSE 1 END
      LIMIT 1;
    END IF;

    DELETE FROM dunasoft.planart WHERE idplan = p_idplan;
    DELETE FROM dunasoft.plan2009 WHERE idplan = p_idplan;

    IF v_appt_id IS NOT NULL THEN
      IF public.appointment_has_completed_sale(v_appt_id) THEN
        UPDATE public.agenda_appointments SET status = 'cancelled', updated_at = now() WHERE id = v_appt_id;
      ELSE
        DELETE FROM public.agenda_appointments WHERE id = v_appt_id;
      END IF;
    END IF;

    UPDATE public.agenda_dunasoft_bridge
    SET dbf_status = 'applied', updated_at = now()
    WHERE legacy_idplan = p_idplan::text;

    RETURN jsonb_build_object(
      'ok', true, 'accion', 'BORRAR', 'idplan', p_idplan,
      'appointment_id', v_appt_id,
      'cancelled_outbound', v_cancelled
    );
  END IF;

  SELECT codemp, codcli, nomcli INTO v_existing
  FROM dunasoft.plan2009 WHERE idplan = p_idplan;

  v_codemp := dunasoft.style_code_or_keep(p_codemp, v_existing.codemp);
  v_codcli := dunasoft.style_code_or_keep(p_codcli, v_existing.codcli);
  v_nomcli := coalesce(nullif(btrim(p_nomcli), ''), nullif(btrim(v_existing.nomcli), ''), 'Cliente');

  SELECT a.id, a.company_id INTO v_appt_id, v_appt_company_id
  FROM public.agenda_appointments a
  WHERE a.legacy_idplan = p_idplan::text
  ORDER BY CASE WHEN a.company_id = p_company_id THEN 0 ELSE 1 END
  LIMIT 1;

  IF v_appt_id IS NULL THEN
    SELECT b.agenda_appointment_id, a.company_id
    INTO v_appt_id, v_appt_company_id
    FROM public.agenda_dunasoft_bridge b
    JOIN public.agenda_appointments a ON a.id = b.agenda_appointment_id
    WHERE b.company_id = p_company_id
      AND b.legacy_idplan = p_idplan::text
    LIMIT 1;
  END IF;

  v_employee_id := public.resolve_agenda_employee_for_dunasoft_codemp(
    coalesce(v_appt_company_id, p_company_id),
    v_codemp
  );

  -- Si Style sigue mandando Paciente InBody …, recuperar identidad real
  IF public.is_inbody_placeholder_customer_name(v_nomcli) THEN
    SELECT r.display_name
    INTO v_recovered_name
    FROM public.recover_real_customer_for_inbody_style(
      coalesce(v_appt_company_id, p_company_id),
      v_codcli,
      nullif(btrim(coalesce(p_tel1cli, '')), '')
    ) r
    LIMIT 1;
    IF v_recovered_name IS NOT NULL THEN
      v_nomcli := v_recovered_name;
    END IF;
  END IF;

  v_customer_id := dunasoft.ensure_customer_for_style_codcli(
    coalesce(v_appt_company_id, p_company_id),
    v_codcli,
    v_nomcli,
    nullif(btrim(coalesce(p_tel1cli, '')), '')
  );

  -- Si ensure devolvió ficha real, alinear nombre mostrado
  IF v_customer_id IS NOT NULL AND public.is_inbody_placeholder_customer_name(v_nomcli) THEN
    SELECT c.name INTO v_recovered_name
    FROM public.customers c
    WHERE c.id = v_customer_id
      AND NOT public.is_inbody_placeholder_customer_name(c.name);
    IF v_recovered_name IS NOT NULL THEN
      v_nomcli := v_recovered_name;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM dunasoft.plan2009 WHERE idplan = p_idplan) THEN
    UPDATE dunasoft.plan2009 SET
      codemp = v_codemp,
      codcli = v_codcli,
      fecha = coalesce(p_fecha, fecha),
      horini = coalesce(nullif(btrim(p_horini), ''), horini),
      horfin = coalesce(nullif(btrim(p_horfin), ''), horfin),
      texto = coalesce(nullif(nullif(btrim(p_texto), ''), ''), texto),
      codrec = coalesce(nullif(v_codrec, ''), codrec),
      nomcli = v_nomcli,
      tel1cli = coalesce(nullif(btrim(p_tel1cli), ''), tel1cli),
      colfon = coalesce(p_colfon, colfon),
      collet = coalesce(p_collet, collet),
      facturado = coalesce(p_facturado, facturado),
      enviadoand = false
    WHERE idplan = p_idplan;
  ELSE
    INSERT INTO dunasoft.plan2009 (
      idplan, codemp, codcli, fecha, horini, horfin, texto, codrec,
      nomcli, tel1cli, colfon, collet, facturado, enviar, idusuweb,
      enviadoand, macand, idand, enviadocro, idcro, enviadoadd, idplanrel, codproce, horaman
    ) VALUES (
      p_idplan,
      v_codemp,
      v_codcli,
      coalesce(p_fecha, current_date),
      coalesce(nullif(btrim(p_horini), ''), '09:00'),
      coalesce(nullif(btrim(p_horfin), ''), '10:00'),
      left(coalesce(nullif(btrim(p_texto), ''), ''), 250),
      coalesce(v_codrec, ''),
      v_nomcli,
      coalesce(p_tel1cli, ''),
      coalesce(p_colfon, 0),
      coalesce(p_collet, 0),
      coalesce(p_facturado, false),
      false, 0, true, '', 0, false, 0, false, 0, '', false
    );
  END IF;

  PERFORM dunasoft.style_reservas_parse_servicios(p_servicios, p_idplan, p_horini);

  IF v_appt_id IS NULL AND v_employee_id IS NOT NULL THEN
    INSERT INTO public.agenda_appointments (
      id, company_id, employee_id, client_name, description,
      appointment_date, start_time, end_time, color, status,
      legacy_idplan, legacy_codcli, legacy_codemp, legacy_codrec, customer_id
    ) VALUES (
      gen_random_uuid(), p_company_id, v_employee_id::text,
      v_nomcli,
      left(coalesce(nullif(btrim(p_texto), ''), ''), 500),
      coalesce(p_fecha, current_date),
      coalesce(nullif(btrim(p_horini), ''), '09:00'),
      coalesce(nullif(btrim(p_horfin), ''), '10:00'),
      'bg-blue-100 border-blue-300', 'confirmed',
      p_idplan::text, v_codcli, v_codemp, nullif(v_codrec, ''),
      v_customer_id
    )
    RETURNING id INTO v_appt_id;

    INSERT INTO public.agenda_dunasoft_bridge (
      company_id, legacy_idplan, agenda_appointment_id, source, dbf_status,
      segment_index, segment_start_time, segment_end_time
    ) VALUES (
      p_company_id, p_idplan::text, v_appt_id, 'dunasoft', 'applied',
      0, coalesce(nullif(btrim(p_horini), ''), '09:00'), coalesce(nullif(btrim(p_horfin), ''), '10:00')
    )
    ON CONFLICT (company_id, legacy_idplan) DO UPDATE SET
      agenda_appointment_id = EXCLUDED.agenda_appointment_id,
      dbf_status = 'applied',
      segment_index = EXCLUDED.segment_index,
      segment_start_time = EXCLUDED.segment_start_time,
      segment_end_time = EXCLUDED.segment_end_time,
      updated_at = now();
  ELSIF v_appt_id IS NOT NULL THEN
    UPDATE public.agenda_appointments SET
      employee_id = coalesce(v_employee_id::text, employee_id),
      client_name = v_nomcli,
      description = CASE
        WHEN v_employee_id IS NOT NULL THEN left(coalesce(nullif(btrim(p_texto), ''), description), 500)
        ELSE description
      END,
      appointment_date = coalesce(p_fecha, appointment_date),
      start_time = coalesce(nullif(btrim(p_horini), ''), start_time),
      end_time = coalesce(nullif(btrim(p_horfin), ''), end_time),
      legacy_codcli = v_codcli,
      legacy_codemp = v_codemp,
      legacy_codrec = coalesce(nullif(v_codrec, ''), legacy_codrec),
      customer_id = coalesce(v_customer_id, customer_id),
      updated_at = now()
    WHERE id = v_appt_id;

    INSERT INTO public.agenda_dunasoft_bridge (
      company_id, legacy_idplan, agenda_appointment_id, source, dbf_status,
      segment_index, segment_start_time, segment_end_time
    ) VALUES (
      p_company_id, p_idplan::text, v_appt_id, 'dunasoft', 'applied',
      coalesce((SELECT max(segment_index) + 1 FROM public.agenda_dunasoft_bridge WHERE agenda_appointment_id = v_appt_id), 0),
      coalesce(nullif(btrim(p_horini), ''), '09:00'),
      coalesce(nullif(btrim(p_horfin), ''), '10:00')
    )
    ON CONFLICT (company_id, legacy_idplan) DO UPDATE SET
      agenda_appointment_id = EXCLUDED.agenda_appointment_id,
      dbf_status = 'applied',
      segment_start_time = EXCLUDED.segment_start_time,
      segment_end_time = EXCLUDED.segment_end_time,
      updated_at = now();
  END IF;

  IF v_appt_id IS NOT NULL THEN
    PERFORM dunasoft.sync_appointment_items_from_style(
      v_appt_id,
      coalesce(v_appt_company_id, p_company_id),
      p_idplan,
      v_codrec,
      p_horini,
      p_horfin,
      p_texto
    );
  END IF;

  IF p_fecha IS NOT NULL THEN
    PERFORM dunasoft.style_merge_consecutive_appointments(p_company_id, p_fecha);
  END IF;

  RETURN jsonb_build_object(
    'ok', true, 'accion', v_accion, 'idplan', p_idplan,
    'appointment_id', v_appt_id,
    'customer_id', v_customer_id,
    'cancelled_outbound', v_cancelled
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- REPARACIÓN DE DATOS
-- ---------------------------------------------------------------------------

DO $$
DECLARE
  v_company uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
  v_lucia uuid := '546f346c-b594-42c0-9e3a-364cb2b479fe';
  v_lucia_ph uuid := 'c8e9ef2f-61dd-4803-8753-facce38fd102';
  v_ana_victoria uuid := '0b20f15c-c330-403f-a7f4-db09a58f72fe';
  v_ana_victoria_ph uuid := '218c004c-61a3-40b7-958b-45cbea291989';
  v_patricia uuid := 'd2a1f82a-ab7b-46af-8549-0af7b2b94010';
  v_patricia_ph uuid := 'f34e286d-b3c0-4a26-8d8a-86e6a9326394';
  r record;
BEGIN
  -- A) Lucía Vizcaíno: primero liberar teléfono de duplicados, luego ficha real
  UPDATE public.customers
  SET phone = NULL,
      phone_mobile = NULL,
      phone_home = NULL,
      archived_at = coalesce(archived_at, now()),
      updated_at = now()
  WHERE id IN (
    'dfcc6d71-f9b0-4069-8157-3c5e7bfe9cf2',
    'a13d873b-506a-4c6e-9a6f-44dfe11fcaec',
    '21b24ca8-4388-408c-95bf-d93c68c05982',
    '9318f744-2107-46f4-a277-5baf7b9e3e27'
  );

  UPDATE public.agenda_appointments
  SET customer_id = v_lucia,
      updated_at = now()
  WHERE customer_id IN (
    'dfcc6d71-f9b0-4069-8157-3c5e7bfe9cf2',
    'a13d873b-506a-4c6e-9a6f-44dfe11fcaec',
    '21b24ca8-4388-408c-95bf-d93c68c05982',
    '9318f744-2107-46f4-a277-5baf7b9e3e27'
  );

  BEGIN
    UPDATE public.customers
    SET phone = coalesce(nullif(btrim(phone), ''), '676400876'),
        phone_mobile = coalesce(nullif(btrim(phone_mobile), ''), '676400876'),
        updated_at = now()
    WHERE id = v_lucia;
  EXCEPTION WHEN unique_violation THEN
    NULL; -- teléfono ya en otra ficha no-archivada
  END;

  UPDATE dunasoft.plan2009
  SET nomcli = 'Lucia Vizcaino Vazquez',
      tel1cli = coalesce(nullif(btrim(tel1cli), ''), '676400876')
  WHERE idplan IN (112569, 112905);

  UPDATE public.agenda_appointments
  SET client_name = 'Lucia Vizcaino Vazquez',
      customer_id = v_lucia,
      updated_at = now()
  WHERE id IN (
    '7fe25f4b-555b-4ced-9b7f-8a0734d65c2a',
    'b21df684-3c85-49a7-84a9-91b8c2418d11'
  );

  -- Mapa Style 008279 / 10000036 / 10000071 → Lucía real
  PERFORM dunasoft.style_map_upsert(v_company, 'customer', '008279', v_lucia, 0, 'style_to_suite', NULL);
  PERFORM dunasoft.style_map_upsert(v_company, 'customer', '10000036', v_lucia, 0, 'style_to_suite', NULL);
  PERFORM dunasoft.style_map_upsert(v_company, 'customer', '10000071', v_lucia, 0, 'style_to_suite', NULL);
  PERFORM dunasoft.style_map_upsert(v_company, 'customer', '008308', v_lucia, 0, 'style_to_suite', NULL);

  -- Placeholder Lucía: quitar codcli Style y archivar
  UPDATE public.customers
  SET legacy_codcli = NULL,
      archived_at = coalesce(archived_at, now()),
      updated_at = now()
  WHERE id = v_lucia_ph;

  -- B) Ana Victoria: citas 008270 → ficha real 32794345W
  UPDATE public.agenda_appointments
  SET customer_id = v_ana_victoria,
      updated_at = now()
  WHERE company_id = v_company
    AND public.legacy_codcli_to_bigint(legacy_codcli) = 8270
    AND appointment_date >= CURRENT_DATE - 180;

  PERFORM dunasoft.style_map_upsert(v_company, 'customer', '008270', v_ana_victoria, 0, 'style_to_suite', NULL);
  UPDATE public.customers
  SET legacy_codcli = NULL,
      archived_at = coalesce(archived_at, now()),
      updated_at = now()
  WHERE id = v_ana_victoria_ph;

  -- C) Patricia Chouciño: citas 008275 → ficha real
  UPDATE public.agenda_appointments
  SET customer_id = v_patricia,
      updated_at = now()
  WHERE company_id = v_company
    AND public.legacy_codcli_to_bigint(legacy_codcli) = 8275
    AND appointment_date >= CURRENT_DATE - 180;

  PERFORM dunasoft.style_map_upsert(v_company, 'customer', '008275', v_patricia, 0, 'style_to_suite', NULL);
  UPDATE public.customers
  SET legacy_codcli = NULL,
      archived_at = coalesce(archived_at, now()),
      updated_at = now()
  WHERE id = v_patricia_ph;

  -- D) Promover placeholders restantes cuyo Style ya tiene nombre real
  FOR r IN
    SELECT DISTINCT ON (ph.id)
      ph.id AS ph_id,
      a.client_name AS real_name,
      ph.legacy_codcli,
      p.tel1cli
    FROM public.customers ph
    JOIN public.agenda_appointments a
      ON a.company_id = ph.company_id
     AND public.legacy_codcli_to_bigint(a.legacy_codcli) = public.legacy_codcli_to_bigint(ph.legacy_codcli)
    LEFT JOIN dunasoft.plan2009 p ON p.idplan::text = a.legacy_idplan
    WHERE ph.company_id = v_company
      AND ph.archived_at IS NULL
      AND public.is_inbody_placeholder_customer_name(ph.name)
      AND nullif(btrim(ph.legacy_codcli), '') IS NOT NULL
      AND NOT public.is_inbody_placeholder_customer_name(a.client_name)
      AND a.appointment_date >= CURRENT_DATE - 180
    ORDER BY ph.id, a.appointment_date DESC
  LOOP
    PERFORM dunasoft.ensure_customer_for_style_codcli(
      v_company,
      r.legacy_codcli,
      r.real_name,
      nullif(btrim(r.tel1cli), '')
    );
  END LOOP;

  -- E) Citas Pattern B: customer_id → ficha real por nombre
  UPDATE public.agenda_appointments AS a
  SET customer_id = real_c.id,
      updated_at = now()
  FROM public.customers AS wrong_c,
       public.customers AS real_c
  WHERE a.customer_id = wrong_c.id
    AND a.company_id = v_company
    AND a.appointment_date >= CURRENT_DATE - 180
    AND public.is_inbody_placeholder_customer_name(wrong_c.name)
    AND NOT public.is_inbody_placeholder_customer_name(a.client_name)
    AND real_c.company_id = a.company_id
    AND real_c.archived_at IS NULL
    AND NOT public.is_inbody_placeholder_customer_name(real_c.name)
    AND lower(btrim(real_c.name)) = lower(btrim(a.client_name))
    AND real_c.id IS DISTINCT FROM wrong_c.id;
END;
$$;
