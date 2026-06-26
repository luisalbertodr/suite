-- Fase 1: Clientes bidireccional Style ↔ Suite.
--   Style → Suite: dunasoft.style_clientes_apply_from_style (llamado por el agente).
--   Suite → Style: trigger en public.customers → dunasoft.enqueue_style_entity (outbox).
-- Prevención de bucle: el apply marca dunasoft.in_style_apply para que el trigger no reencole.

-- ---------------------------------------------------------------------------
-- Helper: ¿está habilitada la sincronización de una tabla para la empresa?
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.entity_sync_enabled(p_company_id uuid, p_tabla text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM dunasoft.style_sync_cursor c
    WHERE c.company_id = p_company_id AND c.tabla = p_tabla AND c.enabled
  );
$$;

GRANT EXECUTE ON FUNCTION dunasoft.entity_sync_enabled(uuid, text) TO service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Style → Suite: aplica un cliente de Style en public.customers
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
BEGIN
  IF v_codcli = '' OR v_codcli = '0' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codcli vacío');
  END IF;

  -- Evita el rebote del trigger Suite→Style mientras aplicamos cambios de Style.
  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  -- 1) Resolver cliente: mapeo explícito → legacy_codcli exacto/normalizado.
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
    -- No borramos el cliente (FKs en ventas/citas); solo dejamos constancia del mapeo.
    IF v_customer_id IS NOT NULL THEN
      PERFORM dunasoft.style_map_upsert(p_company_id, 'customer', v_codcli, v_customer_id, p_sync_version, 'style_to_suite');
    END IF;
    RETURN jsonb_build_object('ok', true, 'accion', 'DELETE', 'codcli', v_codcli, 'customer_id', v_customer_id);
  END IF;

  IF v_name = '' THEN
    v_name := 'Cliente ' || v_codcli;
  END IF;

  -- 2) Resolver colisión de teléfono normalizado (índice único por empresa).
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
      updated_at = now()
    WHERE id = v_customer_id;
  END IF;

  PERFORM dunasoft.style_map_upsert(p_company_id, 'customer', v_codcli, v_customer_id, p_sync_version, 'style_to_suite');

  RETURN jsonb_build_object('ok', true, 'accion', 'UPSERT', 'codcli', v_codcli, 'customer_id', v_customer_id);
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_clientes_apply_from_style(
  uuid, text, text, text, text, text, text, text, text, text, text, text, text, text, text, text, date, boolean, bigint
) TO service_role;

-- ---------------------------------------------------------------------------
-- Suite → Style: encolar altas/ediciones de cliente hacia Style
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.customers_enqueue_style_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_op text;
BEGIN
  -- Cambio originado por el agente al aplicar Style → no reencolar.
  IF current_setting('dunasoft.in_style_apply', true) = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT dunasoft.entity_sync_enabled(NEW.company_id, 'clientes') THEN
    RETURN NEW;
  END IF;

  v_op := CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END;

  PERFORM dunasoft.enqueue_style_entity(
    NEW.company_id,
    'customer',
    v_op,
    NEW.legacy_codcli,
    NEW.id,
    jsonb_build_object(
      'codcli', NEW.legacy_codcli,
      'nomcli', NEW.name,
      'ape1cli', '',
      'tel1cli', coalesce(NEW.phone_home, NEW.phone, ''),
      'tel2cli', coalesce(NEW.phone_mobile, ''),
      'email', coalesce(NEW.email, ''),
      'dnicli', coalesce(NEW.tax_id, ''),
      'dircli', coalesce(NEW.address_street, ''),
      'codposcli', coalesce(NEW.address_postal_code, ''),
      'pobcli', coalesce(NEW.address_city, ''),
      'procli', coalesce(NEW.address_state, ''),
      'pais', coalesce(NEW.address_country, ''),
      'percon', coalesce(NEW.contact_person, ''),
      'obscli', coalesce(NEW.notes, ''),
      'fecnac', coalesce(to_char(NEW.birth_date, 'YYYY-MM-DD'), '')
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_enqueue_style_sync ON public.customers;
CREATE TRIGGER customers_enqueue_style_sync
  AFTER INSERT OR UPDATE ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.customers_enqueue_style_sync();

COMMENT ON TRIGGER customers_enqueue_style_sync ON public.customers IS
  'Encola altas/ediciones de cliente hacia Style (dunasoft.style_sync_outbox) si la tabla clientes está habilitada.';

-- ---------------------------------------------------------------------------
-- Semilla del cursor (deshabilitado: activar manualmente tras pruebas en staging)
-- ---------------------------------------------------------------------------
INSERT INTO dunasoft.style_sync_cursor (company_id, tabla, enabled)
SELECT id, 'clientes', false FROM public.companies
ON CONFLICT (company_id, tabla) DO NOTHING;
