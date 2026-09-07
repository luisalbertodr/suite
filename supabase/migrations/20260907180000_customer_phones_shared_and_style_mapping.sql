-- Teléfonos Style/Suite: unicidad relajada, mapeo correcto tel1/tel2, limpieza y backfill.
-- Convención Style:
--   tel2cli = móvil (SMS/publicidad)
--   tel1cli = fijo, o móvil SOLO si no quieren SMS (tel2 vacío)
-- Suite no debe escribir el móvil en tel1 (bug: coalesce(phone_home, phone)).

BEGIN;

-- 1) Permitir teléfonos compartidos (familias)
DROP INDEX IF EXISTS public.customers_company_phone_norm_uidx;
CREATE INDEX IF NOT EXISTS customers_company_phone_norm_idx
  ON public.customers (company_id, phone_norm)
  WHERE phone_norm IS NOT NULL AND archived_at IS NULL;

COMMENT ON COLUMN public.customers.phone_norm IS
  'Generado: últimos 9 dígitos del teléfono principal (móvil > phone > casa). Índice no único: permite compartir número entre fichas.';

-- 2) Suite → Style: NUNCA usar phone como fallback de tel1
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
      -- tel1 = solo phone_home (fijo / móvil sin SMS). No usar NEW.phone.
      'tel1cli', coalesce(NEW.phone_home, ''),
      -- tel2 = solo móvil SMS
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

-- 3) Resolver Style→Suite: teléfono solo si match ÚNICO (no fusionar familias)
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

  v_id := dunasoft.style_map_suite_id(p_company_id, 'customer', v_codcli);
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

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

  v_phone_norm := public.customer_primary_phone_last9(p_tel2, p_tel1, NULL);
  IF v_phone_norm IS NULL THEN
    v_phone_norm := public.customer_primary_phone_last9(p_tel1, p_tel2, NULL);
  END IF;
  IF v_phone_norm IS NOT NULL THEN
    SELECT count(*), min(c.id) INTO v_n, v_id
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.archived_at IS NULL
      AND c.phone_norm = v_phone_norm;
    IF v_n = 1 THEN
      RETURN v_id;
    END IF;
  END IF;

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
  'Resuelve customer_id Style→Suite: mapa, codcli, teléfono solo si único, DNI único, nombre único.';

-- 4) Limpieza Suite: phone_home copiado del móvil (sin trigger→Style)
SELECT set_config('dunasoft.in_style_apply', '1', true);

-- Restaurar fijo real desde Style si existía y Suite lo pisó con el móvil
UPDATE public.customers c
SET
  phone_home = nullif(btrim(d.tel1cli), ''),
  phone = coalesce(
    nullif(btrim(c.phone_mobile), ''),
    nullif(btrim(d.tel2cli), ''),
    nullif(btrim(d.tel1cli), ''),
    c.phone
  ),
  updated_at = now()
FROM dunasoft.clientes d
WHERE c.archived_at IS NULL
  AND NULLIF(btrim(c.legacy_codcli), '') = NULLIF(btrim(d.codcli), '')
  AND nullif(btrim(c.phone_mobile), '') IS NOT NULL
  AND nullif(btrim(c.phone_home), '') IS NOT NULL
  AND right(regexp_replace(c.phone_mobile, '\D', '', 'g'), 9)
    = right(regexp_replace(c.phone_home, '\D', '', 'g'), 9)
  AND nullif(btrim(d.tel1cli), '') IS NOT NULL
  AND (
    nullif(btrim(d.tel2cli), '') IS NULL
    OR right(regexp_replace(d.tel1cli, '\D', '', 'g'), 9)
      <> right(regexp_replace(d.tel2cli, '\D', '', 'g'), 9)
  );

-- Quitar phone_home cuando es el mismo número que el móvil (caso típico de reescritura)
UPDATE public.customers c
SET
  phone_home = NULL,
  phone = coalesce(nullif(btrim(c.phone_mobile), ''), c.phone),
  updated_at = now()
WHERE c.archived_at IS NULL
  AND nullif(btrim(c.phone_mobile), '') IS NOT NULL
  AND nullif(btrim(c.phone_home), '') IS NOT NULL
  AND right(regexp_replace(c.phone_mobile, '\D', '', 'g'), 9)
    = right(regexp_replace(c.phone_home, '\D', '', 'g'), 9);

-- 5) Backfill fichas vacías desde Style (ahora permitido compartir phone_norm)
UPDATE public.customers c
SET
  phone_home = CASE
    WHEN nullif(btrim(d.tel1cli), '') IS NOT NULL
     AND nullif(btrim(d.tel2cli), '') IS NOT NULL
     AND right(regexp_replace(d.tel1cli, '\D', '', 'g'), 9)
       = right(regexp_replace(d.tel2cli, '\D', '', 'g'), 9)
      THEN NULL
    ELSE nullif(btrim(d.tel1cli), '')
  END,
  phone_mobile = nullif(btrim(d.tel2cli), ''),
  phone = coalesce(nullif(btrim(d.tel2cli), ''), nullif(btrim(d.tel1cli), '')),
  updated_at = now()
FROM dunasoft.clientes d
WHERE c.archived_at IS NULL
  AND NULLIF(btrim(c.legacy_codcli), '') = NULLIF(btrim(d.codcli), '')
  AND nullif(btrim(c.phone), '') IS NULL
  AND nullif(btrim(c.phone_mobile), '') IS NULL
  AND nullif(btrim(c.phone_home), '') IS NULL
  AND (
    nullif(btrim(d.tel1cli), '') IS NOT NULL
    OR nullif(btrim(d.tel2cli), '') IS NOT NULL
  );

-- Complemento desde legacy.clientes si dunasoft no tenía fila
UPDATE public.customers c
SET
  phone_home = CASE
    WHEN nullif(btrim(l.tel1cli), '') IS NOT NULL
     AND nullif(btrim(l.tel2cli), '') IS NOT NULL
     AND right(regexp_replace(l.tel1cli, '\D', '', 'g'), 9)
       = right(regexp_replace(l.tel2cli, '\D', '', 'g'), 9)
      THEN NULL
    ELSE nullif(btrim(l.tel1cli), '')
  END,
  phone_mobile = nullif(btrim(l.tel2cli), ''),
  phone = coalesce(nullif(btrim(l.tel2cli), ''), nullif(btrim(l.tel1cli), '')),
  updated_at = now()
FROM legacy.clientes l
WHERE c.archived_at IS NULL
  AND NULLIF(btrim(c.legacy_codcli), '') = NULLIF(btrim(l.codcli), '')
  AND nullif(btrim(c.phone), '') IS NULL
  AND nullif(btrim(c.phone_mobile), '') IS NULL
  AND nullif(btrim(c.phone_home), '') IS NULL
  AND (
    nullif(btrim(l.tel1cli), '') IS NOT NULL
    OR nullif(btrim(l.tel2cli), '') IS NOT NULL
  );

SELECT set_config('dunasoft.in_style_apply', '0', true);

COMMIT;
