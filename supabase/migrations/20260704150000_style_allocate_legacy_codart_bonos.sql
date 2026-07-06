-- Artículos y bonos nativos Suite sin legacy_codart / legacy_codboncli:
-- asignar código correlativo global (Style = una sola tabla articulos/bonoscli)
-- y encolar hacia Style vía triggers existentes.

-- ---------------------------------------------------------------------------
-- legacy_codart (global entre empresas Suite + legacy + entity_map)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_legacy_codart()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft, legacy
AS $$
DECLARE
  v_max bigint := 0;
  v_next bigint;
  v_width int := 6;
  v_code text;
  v_attempt int := 0;
  v_tmp bigint;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 20 THEN
      RAISE EXCEPTION 'No se pudo asignar legacy_codart único (global Style)';
    END IF;

    LOCK TABLE public.articles IN EXCLUSIVE MODE;

    SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(a.legacy_codart)), 0)
    INTO v_max
    FROM public.articles a
    WHERE a.legacy_codart IS NOT NULL AND btrim(a.legacy_codart) <> '';

    IF to_regclass('legacy.articulos') IS NOT NULL THEN
      EXECUTE $sql$
        SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(btrim(codart::text))), 0)
        FROM legacy.articulos
        WHERE codart IS NOT NULL AND btrim(codart::text) <> ''
      $sql$
      INTO v_tmp;
      v_max := GREATEST(v_max, COALESCE(v_tmp, 0));
    END IF;

    IF to_regclass('dunasoft.style_sync_entity_map') IS NOT NULL THEN
      SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(btrim(m.style_key))), 0)
      INTO v_tmp
      FROM dunasoft.style_sync_entity_map m
      WHERE m.entity_type = 'article'
        AND m.style_key IS NOT NULL
        AND btrim(m.style_key) <> '';
      v_max := GREATEST(v_max, COALESCE(v_tmp, 0));
    END IF;

    v_next := v_max + 1;

    SELECT COALESCE(MAX(length(btrim(legacy_codart))), 6)
    INTO v_width
    FROM public.articles
    WHERE legacy_codart IS NOT NULL
      AND btrim(legacy_codart) ~ '^\d+$'
      AND public.legacy_codcli_to_bigint(legacy_codart) = v_max;

    IF v_width IS NULL OR v_width < 4 THEN
      v_width := 6;
    END IF;

    v_code := public.format_legacy_codcli(v_next, v_width);

    IF NOT EXISTS (
      SELECT 1
      FROM public.articles a
      WHERE a.legacy_codart IS NOT NULL
        AND btrim(a.legacy_codart) <> ''
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
          AND (
            btrim(m.style_key) = btrim(v_code)
            OR public.legacy_codcli_to_bigint(m.style_key) = v_next
          )
      )
    ) THEN
      RETURN v_code;
    END IF;

    v_max := v_next;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_legacy_codart() IS
  'Siguiente codart Dunasoft global (max en articles, legacy.articulos y style_sync_entity_map article).';

CREATE OR REPLACE FUNCTION public.articles_assign_legacy_codart()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('dunasoft.in_style_apply', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.legacy_codart IS NULL OR btrim(NEW.legacy_codart) = '' THEN
    NEW.legacy_codart := public.generate_legacy_codart();
  ELSE
    NEW.legacy_codart := btrim(NEW.legacy_codart);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS articles_assign_legacy_codart ON public.articles;

CREATE TRIGGER articles_assign_legacy_codart
  BEFORE INSERT OR UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.articles_assign_legacy_codart();

COMMENT ON TRIGGER articles_assign_legacy_codart ON public.articles IS
  'Asigna legacy_codart correlativo global si falta, para sync Suite→Style.';

-- ---------------------------------------------------------------------------
-- legacy_codboncli (global)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_legacy_codboncli()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft, legacy
AS $$
DECLARE
  v_max bigint := 0;
  v_next bigint;
  v_width int := 6;
  v_code text;
  v_attempt int := 0;
  v_tmp bigint;
BEGIN
  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 20 THEN
      RAISE EXCEPTION 'No se pudo asignar legacy_codboncli único (global Style)';
    END IF;

    LOCK TABLE public.bonos IN EXCLUSIVE MODE;

    SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(b.legacy_codboncli)), 0)
    INTO v_max
    FROM public.bonos b
    WHERE b.legacy_codboncli IS NOT NULL AND btrim(b.legacy_codboncli) <> '';

    IF to_regclass('legacy.bonoscli') IS NOT NULL THEN
      EXECUTE $sql$
        SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(btrim(codboncli::text))), 0)
        FROM legacy.bonoscli
        WHERE codboncli IS NOT NULL AND btrim(codboncli::text) <> ''
      $sql$
      INTO v_tmp;
      v_max := GREATEST(v_max, COALESCE(v_tmp, 0));
    END IF;

    IF to_regclass('dunasoft.style_sync_entity_map') IS NOT NULL THEN
      SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(btrim(m.style_key))), 0)
      INTO v_tmp
      FROM dunasoft.style_sync_entity_map m
      WHERE m.entity_type = 'bono'
        AND m.style_key IS NOT NULL
        AND btrim(m.style_key) <> '';
      v_max := GREATEST(v_max, COALESCE(v_tmp, 0));
    END IF;

    v_next := v_max + 1;

    SELECT COALESCE(MAX(length(btrim(legacy_codboncli))), 6)
    INTO v_width
    FROM public.bonos
    WHERE legacy_codboncli IS NOT NULL
      AND btrim(legacy_codboncli) ~ '^\d+$'
      AND public.legacy_codcli_to_bigint(legacy_codboncli) = v_max;

    IF v_width IS NULL OR v_width < 4 THEN
      v_width := 6;
    END IF;

    v_code := public.format_legacy_codcli(v_next, v_width);

    IF NOT EXISTS (
      SELECT 1
      FROM public.bonos b
      WHERE b.legacy_codboncli IS NOT NULL
        AND btrim(b.legacy_codboncli) <> ''
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
          AND (
            btrim(m.style_key) = btrim(v_code)
            OR public.legacy_codcli_to_bigint(m.style_key) = v_next
          )
      )
    ) THEN
      RETURN v_code;
    END IF;

    v_max := v_next;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_legacy_codboncli() IS
  'Siguiente codboncli Dunasoft global (max en bonos, legacy.bonoscli y style_sync_entity_map bono).';

CREATE OR REPLACE FUNCTION public.bonos_assign_legacy_codboncli()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('dunasoft.in_style_apply', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF NEW.legacy_codboncli IS NULL OR btrim(NEW.legacy_codboncli) = '' THEN
    NEW.legacy_codboncli := public.generate_legacy_codboncli();
  ELSE
    NEW.legacy_codboncli := btrim(NEW.legacy_codboncli);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bonos_assign_legacy_codboncli ON public.bonos;

CREATE TRIGGER bonos_assign_legacy_codboncli
  BEFORE INSERT OR UPDATE ON public.bonos
  FOR EACH ROW
  EXECUTE FUNCTION public.bonos_assign_legacy_codboncli();

COMMENT ON TRIGGER bonos_assign_legacy_codboncli ON public.bonos IS
  'Asigna legacy_codboncli correlativo global si falta, para sync Suite→Style.';

-- ---------------------------------------------------------------------------
-- Encolado: ya no omitir filas sin código (BEFORE trigger lo asigna antes)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.articles_enqueue_style_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_scale numeric;
BEGIN
  IF current_setting('dunasoft.in_style_apply', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NOT dunasoft.suite_to_style_enabled('articulos') THEN
    RETURN NEW;
  END IF;
  IF NEW.legacy_codart IS NULL OR btrim(NEW.legacy_codart) = '' THEN
    RETURN NEW;
  END IF;

  v_scale := NULLIF(dunasoft.style_price_scale(NEW.company_id), 0);

  PERFORM dunasoft.enqueue_style_entity(
    NEW.company_id, 'article',
    CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END,
    NEW.legacy_codart, NEW.id,
    jsonb_build_object(
      'codart', NEW.legacy_codart,
      'desart', NEW.descripcion,
      'familia1', coalesce(NEW.legacy_familia_code, ''),
      'pvpa', CASE WHEN v_scale IS NULL THEN NEW.precio ELSE NEW.precio / v_scale END,
      'coste', CASE WHEN v_scale IS NULL THEN NEW.precio_compra ELSE NEW.precio_compra / v_scale END,
      'stock', NEW.stock_actual,
      'iva', NEW.iva_percentage,
      'obsoleto', CASE WHEN NEW.estado = 'inactivo' THEN 'SI' ELSE 'NO' END
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.bonos_enqueue_style_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_codcli text;
BEGIN
  IF current_setting('dunasoft.in_style_apply', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NOT dunasoft.suite_to_style_enabled('bonoscli') THEN
    RETURN NEW;
  END IF;
  IF NEW.legacy_codboncli IS NULL OR btrim(NEW.legacy_codboncli) = '' THEN
    RETURN NEW;
  END IF;

  SELECT legacy_codcli INTO v_codcli FROM public.customers WHERE id = NEW.customer_id;

  PERFORM dunasoft.enqueue_style_entity(
    NEW.company_id, 'bono',
    CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END,
    NEW.legacy_codboncli, NEW.id,
    jsonb_build_object(
      'codboncli', NEW.legacy_codboncli,
      'codcli', coalesce(v_codcli, ''),
      'desbon', NEW.nombre,
      'sesiones', NEW.sesiones_totales,
      'consumidas', NEW.sesiones_usadas,
      'obsoleto', CASE WHEN NEW.estado = 'inactivo' THEN 'SI' ELSE 'NO' END
    )
  );
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Backfill: registros existentes sin código (dispara assign + enqueue si sync ON)
-- ---------------------------------------------------------------------------
UPDATE public.articles a
SET descripcion = a.descripcion
WHERE a.legacy_codart IS NULL OR btrim(a.legacy_codart) = '';

UPDATE public.bonos b
SET nombre = b.nombre
WHERE b.legacy_codboncli IS NULL OR btrim(b.legacy_codboncli) = '';
