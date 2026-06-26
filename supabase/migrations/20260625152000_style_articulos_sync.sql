-- Fase 2: Artículos y familias Style → Suite (dirección prioritaria).
--   Style gana en precio/stock/descripción/familia/baja.
--   Suite → Style limitado a altas nativas con legacy_codart (trigger guardado).
-- Escala monetaria: los precios de Style son enteros escalados; se aplica price_scale por empresa.

-- ---------------------------------------------------------------------------
-- Ajustes por empresa (escala de precios usada en el import legacy)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS dunasoft.style_sync_settings (
  company_id  uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  price_scale numeric NOT NULL DEFAULT 1,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE dunasoft.style_sync_settings IS
  'Parámetros del canal Style por empresa. price_scale alinea importes DBF con el import legacy (p. ej. 0.01).';

GRANT SELECT, INSERT, UPDATE ON dunasoft.style_sync_settings TO service_role;

CREATE OR REPLACE FUNCTION dunasoft.style_price_scale(p_company_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT COALESCE(
    (SELECT price_scale FROM dunasoft.style_sync_settings WHERE company_id = p_company_id),
    1
  );
$$;

-- ---------------------------------------------------------------------------
-- Resolución de familia (codfam1 → etiqueta «cod-desfam1»)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.style_resolve_familia(p_familia_code text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public, legacy
AS $$
DECLARE
  v_code text := btrim(coalesce(p_familia_code, ''));
  v_des text;
BEGIN
  IF v_code = '' OR lower(v_code) = 'none' THEN
    RETURN 'Varios';
  END IF;
  IF to_regclass('legacy.familia1') IS NOT NULL THEN
    EXECUTE 'SELECT btrim(desfam1) FROM legacy.familia1 WHERE btrim(codfam1::text) = $1 LIMIT 1'
      INTO v_des USING v_code;
  END IF;
  IF v_des IS NOT NULL AND v_des <> '' THEN
    RETURN v_code || '-' || v_des;
  END IF;
  RETURN v_code;
END;
$$;

-- ---------------------------------------------------------------------------
-- Style → Suite: aplica un artículo de Style en public.articles
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.style_articulos_apply_from_style(
  p_company_id uuid,
  p_accion     text,
  p_codart     text,
  p_desart     text,
  p_familia1   text,
  p_tipart     text,
  p_coste      numeric,
  p_pvpa       numeric,
  p_stock      numeric,
  p_iva        numeric,
  p_tiempo     numeric,
  p_obsoleto   boolean,
  p_foto       text,
  p_sync_version bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_accion text := upper(btrim(coalesce(p_accion, 'UPSERT')));
  v_codart text := btrim(coalesce(p_codart, ''));
  v_scale numeric := dunasoft.style_price_scale(p_company_id);
  v_familia text := dunasoft.style_resolve_familia(p_familia1);
  v_kind text;
  v_estado text := CASE WHEN coalesce(p_obsoleto, false) THEN 'inactivo' ELSE 'activo' END;
  v_iva numeric := CASE WHEN coalesce(p_iva, 0) IN (0, 4, 10, 21) THEN p_iva ELSE 21 END;
  v_codigo text;
  v_article_id uuid;
BEGIN
  IF v_codart = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codart vacío');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  IF v_accion IN ('DELETE', 'BAJA', 'BORRAR') THEN
    UPDATE public.articles
    SET estado = 'inactivo', updated_at = now()
    WHERE company_id = p_company_id AND legacy_codart = v_codart;
    RETURN jsonb_build_object('ok', true, 'accion', 'DELETE', 'codart', v_codart);
  END IF;

  v_kind := CASE
    WHEN position('serv' in lower(coalesce(p_tipart, ''))) > 0 THEN 'servicio'
    WHEN coalesce(p_tiempo, 0) > 0 THEN 'servicio'
    ELSE 'producto'
  END;

  -- Familia en article_families (idempotente).
  INSERT INTO public.article_families (company_id, name)
  VALUES (p_company_id, v_familia)
  ON CONFLICT (company_id, name) DO NOTHING;

  SELECT id INTO v_article_id
  FROM public.articles
  WHERE company_id = p_company_id AND legacy_codart = v_codart
  LIMIT 1;

  IF v_article_id IS NULL THEN
    v_codigo := 'LEG-' || regexp_replace(v_codart, '[^A-Za-z0-9_-]', '', 'g');
    v_codigo := left(coalesce(nullif(v_codigo, 'LEG-'), 'LEG-' || v_codart), 60);
    -- Evitar choque con UNIQUE global de codigo.
    IF EXISTS (SELECT 1 FROM public.articles WHERE codigo = v_codigo AND company_id <> p_company_id) THEN
      v_codigo := left(v_codigo || '-' || replace(p_company_id::text, '-', ''), 60);
    END IF;

    INSERT INTO public.articles (
      company_id, codigo, descripcion, familia, precio, precio_compra,
      stock_actual, stock_minimo, estado, tipo_producto, iva_percentage,
      article_kind, duration_minutes, legacy_codart, legacy_tipart, legacy_familia_code, legacy_photo_path
    ) VALUES (
      p_company_id, v_codigo,
      left(coalesce(nullif(btrim(coalesce(p_desart, '')), ''), v_codart), 255),
      v_familia,
      coalesce(p_pvpa, 0) * v_scale,
      coalesce(p_coste, 0) * v_scale,
      coalesce(p_stock, 0), 0, v_estado,
      CASE WHEN v_kind = 'servicio' THEN 'servicio' ELSE 'producto' END,
      v_iva, v_kind, GREATEST(0, coalesce(p_tiempo, 0))::int,
      v_codart,
      nullif(left(btrim(coalesce(p_tipart, '')), 120), ''),
      nullif(btrim(coalesce(p_familia1, '')), ''),
      nullif(btrim(coalesce(p_foto, '')), '')
    )
    RETURNING id INTO v_article_id;
  ELSE
    UPDATE public.articles SET
      descripcion = left(coalesce(nullif(btrim(coalesce(p_desart, '')), ''), descripcion), 255),
      familia = v_familia,
      precio = coalesce(p_pvpa, 0) * v_scale,
      precio_compra = coalesce(p_coste, 0) * v_scale,
      stock_actual = coalesce(p_stock, stock_actual),
      estado = v_estado,
      iva_percentage = v_iva,
      article_kind = v_kind,
      duration_minutes = GREATEST(0, coalesce(p_tiempo, 0))::int,
      legacy_tipart = nullif(left(btrim(coalesce(p_tipart, '')), 120), ''),
      legacy_familia_code = nullif(btrim(coalesce(p_familia1, '')), ''),
      legacy_photo_path = coalesce(nullif(btrim(coalesce(p_foto, '')), ''), legacy_photo_path),
      updated_at = now()
    WHERE id = v_article_id;
  END IF;

  PERFORM dunasoft.style_map_upsert(p_company_id, 'article', v_codart, v_article_id, p_sync_version, 'style_to_suite');

  RETURN jsonb_build_object('ok', true, 'accion', 'UPSERT', 'codart', v_codart, 'article_id', v_article_id);
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_articulos_apply_from_style(
  uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, boolean, text, bigint
) TO service_role;

-- ---------------------------------------------------------------------------
-- Suite → Style: solo altas nativas Suite con legacy_codart (no toca catálogo POS masivo)
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
  IF NOT dunasoft.entity_sync_enabled(NEW.company_id, 'articulos') THEN
    RETURN NEW;
  END IF;
  -- Solo propagamos artículos con código legacy (los nativos sin legacy_codart no van al POS).
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

DROP TRIGGER IF EXISTS articles_enqueue_style_sync ON public.articles;
CREATE TRIGGER articles_enqueue_style_sync
  AFTER INSERT OR UPDATE ON public.articles
  FOR EACH ROW
  EXECUTE FUNCTION public.articles_enqueue_style_sync();

INSERT INTO dunasoft.style_sync_cursor (company_id, tabla, enabled)
SELECT id, 'articulos', false FROM public.companies
ON CONFLICT (company_id, tabla) DO NOTHING;
