-- Serie Style (1..999999): siguiente codcli sin usar banda 10M+ ni basura 999999x.
-- Incluye dunasoft.clientes para no pisar altas Style aún no reflejadas en customers.

CREATE OR REPLACE FUNCTION public.generate_legacy_codcli(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_band_min bigint := 1;
  v_band_max bigint := 999999; -- Style: PADL 6 dígitos
  v_max bigint := 0;
  v_next bigint;
  v_width int := 6;
  v_code text;
  v_attempt int := 0;
  v_tmp bigint;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id requerido para generate_legacy_codcli';
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 50 THEN
      RAISE EXCEPTION 'No se pudo asignar legacy_codcli único (serie Style) para company %', p_company_id;
    END IF;

    LOCK TABLE public.customers IN EXCLUSIVE MODE;

    SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(c.legacy_codcli)), 0)
    INTO v_max
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.legacy_codcli IS NOT NULL
      AND btrim(c.legacy_codcli) ~ '^\d+$'
      AND public.legacy_codcli_to_bigint(c.legacy_codcli) BETWEEN v_band_min AND v_band_max;

    IF to_regclass('dunasoft.clientes') IS NOT NULL THEN
      SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(btrim(d.codcli::text))), 0)
      INTO v_tmp
      FROM dunasoft.clientes d
      WHERE d.codcli IS NOT NULL
        AND btrim(d.codcli::text) ~ '^\d+$'
        AND public.legacy_codcli_to_bigint(btrim(d.codcli::text)) BETWEEN v_band_min AND v_band_max;
      v_max := GREATEST(v_max, COALESCE(v_tmp, 0));
    END IF;

    IF to_regclass('legacy.clientes') IS NOT NULL THEN
      EXECUTE $sql$
        SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(btrim(codcli::text))), 0)
        FROM legacy.clientes
        WHERE codcli IS NOT NULL
          AND btrim(codcli::text) ~ '^\d+$'
          AND public.legacy_codcli_to_bigint(btrim(codcli::text)) BETWEEN $1 AND $2
      $sql$
      INTO v_tmp
      USING v_band_min, v_band_max;
      v_max := GREATEST(v_max, COALESCE(v_tmp, 0));
    END IF;

    -- Mapa Style→Suite: claves ya usadas en Style aunque el customer aún no exista
    IF to_regclass('dunasoft.style_sync_entity_map') IS NOT NULL THEN
      SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(btrim(m.style_key))), 0)
      INTO v_tmp
      FROM dunasoft.style_sync_entity_map m
      WHERE m.entity_type = 'customer'
        AND m.style_key IS NOT NULL
        AND btrim(m.style_key) ~ '^\d+$'
        AND public.legacy_codcli_to_bigint(m.style_key) BETWEEN v_band_min AND v_band_max;
      v_max := GREATEST(v_max, COALESCE(v_tmp, 0));
    END IF;

    v_next := GREATEST(v_max + 1, v_band_min);
    IF v_next > v_band_max THEN
      RAISE EXCEPTION 'Serie Style de codcli agotada (1–999999) para company %', p_company_id;
    END IF;

    v_width := 6;
    v_code := public.format_legacy_codcli(v_next, v_width);

    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.company_id = p_company_id
        AND c.legacy_codcli IS NOT NULL
        AND btrim(c.legacy_codcli) <> ''
        AND (
          btrim(c.legacy_codcli) = btrim(v_code)
          OR public.legacy_codcli_to_bigint(c.legacy_codcli) = v_next
        )
    ) AND NOT EXISTS (
      SELECT 1
      FROM dunasoft.clientes d
      WHERE d.codcli IS NOT NULL
        AND btrim(d.codcli::text) <> ''
        AND (
          lpad(btrim(d.codcli::text), 6, '0') = v_code
          OR public.legacy_codcli_to_bigint(btrim(d.codcli::text)) = v_next
        )
    ) THEN
      RETURN v_code;
    END IF;

    v_max := v_next;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_legacy_codcli(uuid) IS
  'Siguiente codcli en serie Style (1–999999), max(customers + dunasoft.clientes + mapa). No usa banda 10M+.';
