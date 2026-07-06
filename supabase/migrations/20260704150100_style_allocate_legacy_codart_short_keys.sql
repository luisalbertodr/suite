-- Corrige asignación legacy_codart: secuencia en banda Suite 100000000–999999999
-- (evita colisión con EAN y con códigos Style cortos <= 8 dígitos).
-- Reasigna artículos que recibieron claves 8430795000xxxx en el backfill anterior.

CREATE OR REPLACE FUNCTION public.generate_legacy_codart()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft, legacy
AS $$
DECLARE
  v_band_min bigint := 100000000;
  v_band_max bigint := 999999999;
  v_max_band bigint := 0;
  v_next bigint;
  v_width int := 9;
  v_code text;
  v_attempt int := 0;
  v_tmp bigint;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 100 THEN
      RAISE EXCEPTION 'No se pudo asignar legacy_codart único (global Style)';
    END IF;

    LOCK TABLE public.articles IN EXCLUSIVE MODE;

    SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(a.legacy_codart)), 0)
    INTO v_max_band
    FROM public.articles a
    WHERE a.legacy_codart IS NOT NULL
      AND btrim(a.legacy_codart) <> ''
      AND btrim(a.legacy_codart) ~ '^\d+$'
      AND public.legacy_codcli_to_bigint(a.legacy_codart) BETWEEN v_band_min AND v_band_max;

    IF to_regclass('legacy.articulos') IS NOT NULL THEN
      EXECUTE $sql$
        SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(btrim(codart::text))), 0)
        FROM legacy.articulos
        WHERE codart IS NOT NULL
          AND btrim(codart::text) <> ''
          AND btrim(codart::text) ~ '^\d+$'
          AND public.legacy_codcli_to_bigint(btrim(codart::text)) BETWEEN $1 AND $2
      $sql$
      INTO v_tmp
      USING v_band_min, v_band_max;
      v_max_band := GREATEST(v_max_band, COALESCE(v_tmp, 0));
    END IF;

    IF to_regclass('dunasoft.style_sync_entity_map') IS NOT NULL THEN
      SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(btrim(m.style_key))), 0)
      INTO v_tmp
      FROM dunasoft.style_sync_entity_map m
      WHERE m.entity_type = 'article'
        AND m.style_key IS NOT NULL
        AND btrim(m.style_key) <> ''
        AND btrim(m.style_key) ~ '^\d+$'
        AND public.legacy_codcli_to_bigint(m.style_key) BETWEEN v_band_min AND v_band_max;
      v_max_band := GREATEST(v_max_band, COALESCE(v_tmp, 0));
    END IF;

    v_next := GREATEST(v_max_band + 1, v_band_min);
    IF v_next > v_band_max THEN
      RAISE EXCEPTION 'Banda legacy_codart Suite agotada (%–%)', v_band_min, v_band_max;
    END IF;

    v_width := GREATEST(9, length(v_next::text));

    v_code := public.format_legacy_codcli(v_next, v_width);

    IF NOT EXISTS (
      SELECT 1
      FROM public.articles a
      WHERE a.legacy_codart IS NOT NULL
        AND btrim(a.legacy_codart) <> ''
        AND btrim(a.legacy_codart) ~ '^\d+$'
        AND (
          btrim(a.legacy_codart) = btrim(v_code)
          OR public.legacy_codcli_to_bigint(a.legacy_codart) = v_next
        )
    )
    AND (
      to_regclass('legacy.articulos') IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM legacy.articulos la
        WHERE la.codart IS NOT NULL
          AND btrim(la.codart::text) <> ''
          AND btrim(la.codart::text) ~ '^\d+$'
          AND (
            btrim(la.codart::text) = btrim(v_code)
            OR public.legacy_codcli_to_bigint(btrim(la.codart::text)) = v_next
          )
      )
    )
    AND (
      to_regclass('dunasoft.style_sync_entity_map') IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM dunasoft.style_sync_entity_map m
        WHERE m.entity_type = 'article'
          AND m.style_key IS NOT NULL
          AND btrim(m.style_key) <> ''
          AND btrim(m.style_key) ~ '^\d+$'
          AND (
            btrim(m.style_key) = btrim(v_code)
            OR public.legacy_codcli_to_bigint(m.style_key) = v_next
          )
      )
    ) THEN
      RETURN v_code;
    END IF;

    v_max_band := v_next;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_legacy_codart() IS
  'Siguiente codart Suite-native en banda 100000000–999999999; colisión global con cualquier numérico.';

CREATE OR REPLACE FUNCTION public.generate_legacy_codboncli()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft, legacy
AS $$
DECLARE
  v_band_min bigint := 100000000;
  v_band_max bigint := 999999999;
  v_max_band bigint := 0;
  v_next bigint;
  v_width int := 9;
  v_code text;
  v_attempt int := 0;
  v_tmp bigint;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 100 THEN
      RAISE EXCEPTION 'No se pudo asignar legacy_codboncli único (global Style)';
    END IF;

    LOCK TABLE public.bonos IN EXCLUSIVE MODE;

    SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(b.legacy_codboncli)), 0)
    INTO v_max_band
    FROM public.bonos b
    WHERE b.legacy_codboncli IS NOT NULL
      AND btrim(b.legacy_codboncli) <> ''
      AND btrim(b.legacy_codboncli) ~ '^\d+$'
      AND public.legacy_codcli_to_bigint(b.legacy_codboncli) BETWEEN v_band_min AND v_band_max;

    IF to_regclass('legacy.bonoscli') IS NOT NULL THEN
      EXECUTE $sql$
        SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(btrim(codboncli::text))), 0)
        FROM legacy.bonoscli
        WHERE codboncli IS NOT NULL
          AND btrim(codboncli::text) <> ''
          AND btrim(codboncli::text) ~ '^\d+$'
          AND public.legacy_codcli_to_bigint(btrim(codboncli::text)) BETWEEN $1 AND $2
      $sql$
      INTO v_tmp
      USING v_band_min, v_band_max;
      v_max_band := GREATEST(v_max_band, COALESCE(v_tmp, 0));
    END IF;

    IF to_regclass('dunasoft.style_sync_entity_map') IS NOT NULL THEN
      SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(btrim(m.style_key))), 0)
      INTO v_tmp
      FROM dunasoft.style_sync_entity_map m
      WHERE m.entity_type = 'bono'
        AND m.style_key IS NOT NULL
        AND btrim(m.style_key) <> ''
        AND btrim(m.style_key) ~ '^\d+$'
        AND public.legacy_codcli_to_bigint(m.style_key) BETWEEN v_band_min AND v_band_max;
      v_max_band := GREATEST(v_max_band, COALESCE(v_tmp, 0));
    END IF;

    v_next := GREATEST(v_max_band + 1, v_band_min);
    IF v_next > v_band_max THEN
      RAISE EXCEPTION 'Banda legacy_codboncli Suite agotada (%–%)', v_band_min, v_band_max;
    END IF;

    v_width := GREATEST(9, length(v_next::text));
    v_code := public.format_legacy_codcli(v_next, v_width);

    IF NOT EXISTS (
      SELECT 1
      FROM public.bonos b
      WHERE b.legacy_codboncli IS NOT NULL
        AND btrim(b.legacy_codboncli) <> ''
        AND btrim(b.legacy_codboncli) ~ '^\d+$'
        AND (
          btrim(b.legacy_codboncli) = btrim(v_code)
          OR public.legacy_codcli_to_bigint(b.legacy_codboncli) = v_next
        )
    )
    AND (
      to_regclass('legacy.bonoscli') IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM legacy.bonoscli lb
        WHERE lb.codboncli IS NOT NULL
          AND btrim(lb.codboncli::text) <> ''
          AND btrim(lb.codboncli::text) ~ '^\d+$'
          AND (
            btrim(lb.codboncli::text) = btrim(v_code)
            OR public.legacy_codcli_to_bigint(btrim(lb.codboncli::text)) = v_next
          )
      )
    )
    AND (
      to_regclass('dunasoft.style_sync_entity_map') IS NULL
      OR NOT EXISTS (
        SELECT 1
        FROM dunasoft.style_sync_entity_map m
        WHERE m.entity_type = 'bono'
          AND m.style_key IS NOT NULL
          AND btrim(m.style_key) <> ''
          AND btrim(m.style_key) ~ '^\d+$'
          AND (
            btrim(m.style_key) = btrim(v_code)
            OR public.legacy_codcli_to_bigint(m.style_key) = v_next
          )
      )
    ) THEN
      RETURN v_code;
    END IF;

    v_max_band := v_next;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_legacy_codboncli() IS
  'Siguiente codboncli Suite-native en banda 100000000–999999999; colisión global con cualquier numérico.';

DELETE FROM dunasoft.style_sync_outbox o
WHERE o.entity_type = 'article'
  AND o.delivered_at IS NULL
  AND o.suite_id IN (
    SELECT a.id
    FROM public.articles a
    WHERE a.legacy_codart ~ '^8430795000[0-9]{4}$'
      AND NOT EXISTS (
        SELECT 1
        FROM legacy.articulos la
        WHERE btrim(la.codart::text) = btrim(a.legacy_codart)
      )
  );

ALTER TABLE public.articles DISABLE TRIGGER articles_assign_legacy_codart;

UPDATE public.articles a
SET legacy_codart = NULL
WHERE a.legacy_codart ~ '^8430795000[0-9]{4}$'
  AND NOT EXISTS (
    SELECT 1
    FROM legacy.articulos la
    WHERE btrim(la.codart::text) = btrim(a.legacy_codart)
  );

ALTER TABLE public.articles ENABLE TRIGGER articles_assign_legacy_codart;

UPDATE public.articles a
SET descripcion = a.descripcion
WHERE a.legacy_codart IS NULL OR btrim(a.legacy_codart) = '';
