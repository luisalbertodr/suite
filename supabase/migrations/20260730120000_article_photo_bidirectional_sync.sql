-- Fotos de artículos: Suite lee foto_url (Supabase Storage); Style mantiene articulos.foto + Fotografias.
-- El agente sincroniza binarios en ambos sentidos sin reencolar outbox.

CREATE OR REPLACE FUNCTION dunasoft.style_article_photo_apply(
  p_company_id uuid,
  p_legacy_codart text,
  p_foto_url text,
  p_legacy_photo_path text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_codart text := btrim(coalesce(p_legacy_codart, ''));
BEGIN
  IF v_codart = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codart vacío');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  UPDATE public.articles SET
    foto_url = nullif(btrim(coalesce(p_foto_url, '')), ''),
    legacy_photo_path = coalesce(
      nullif(btrim(coalesce(p_legacy_photo_path, '')), ''),
      legacy_photo_path
    ),
    updated_at = now()
  WHERE company_id = p_company_id
    AND legacy_codart = v_codart;

  RETURN jsonb_build_object(
    'ok', true,
    'updated', FOUND,
    'codart', v_codart
  );
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_article_photo_apply(uuid, text, text, text) TO service_role;

-- Incluir metadatos de foto en outbox Suite → Style.
CREATE OR REPLACE FUNCTION public.articles_enqueue_style_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_scale numeric;
  v_foto text;
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
  v_foto := nullif(
    btrim(regexp_replace(coalesce(NEW.legacy_photo_path, ''), '^.*[/\\]', '')),
    ''
  );

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
      'obsoleto', CASE WHEN NEW.estado = 'inactivo' THEN 'SI' ELSE 'NO' END,
      'foto', coalesce(v_foto, ''),
      'foto_url', coalesce(NEW.foto_url, '')
    )
  );
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION dunasoft.style_article_photo_apply IS
  'Actualiza foto_url/legacy_photo_path tras subir binario desde Style; evita bucle outbox con in_style_apply.';
