-- Sync catálogo de recursos Style (codrec) → public.recursos

ALTER TABLE public.recursos
  ADD COLUMN IF NOT EXISTS dunasoft_codrec text;

CREATE INDEX IF NOT EXISTS idx_recursos_company_dunasoft_codrec
  ON public.recursos (company_id, dunasoft_codrec)
  WHERE dunasoft_codrec IS NOT NULL AND btrim(dunasoft_codrec) <> '';

COMMENT ON COLUMN public.recursos.dunasoft_codrec IS
  'Código de recurso en Style/Dunasoft (codrec) para sincronizar citas y colores.';

CREATE OR REPLACE FUNCTION public.vfp_color_to_hex(p_value bigint)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v int;
  r int;
  g int;
  b int;
BEGIN
  v := coalesce(p_value, 0)::int;
  IF v <= 0 THEN
    RETURN NULL;
  END IF;
  r := v & 255;
  g := (v >> 8) & 255;
  b := (v >> 16) & 255;
  RETURN '#' || lpad(to_hex(r), 2, '0') || lpad(to_hex(g), 2, '0') || lpad(to_hex(b), 2, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.hex_to_vfp_color(p_hex text)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  h text := lower(btrim(coalesce(p_hex, '')));
  bytes bytea;
BEGIN
  IF h ~ '^#[0-9a-f]{6}$' THEN
    h := substr(h, 2);
  ELSIF length(h) <> 6 OR h !~ '^[0-9a-f]{6}$' THEN
    RETURN 0;
  END IF;
  bytes := decode(h, 'hex');
  RETURN get_byte(bytes, 0) + (get_byte(bytes, 1) << 8) + (get_byte(bytes, 2) << 16);
END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_dunasoft_codrec(p_codrec text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT coalesce(nullif(ltrim(btrim(coalesce(p_codrec, '')), '0'), ''), '0');
$$;

CREATE OR REPLACE FUNCTION public.resolve_agenda_recurso_for_dunasoft_codrec(
  p_company_id uuid,
  p_codrec text
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_codrec text := btrim(coalesce(p_codrec, ''));
  v_norm text := public.normalize_dunasoft_codrec(v_codrec);
  v_id uuid;
BEGIN
  IF p_company_id IS NULL OR v_codrec = '' OR v_codrec = '0' THEN
    RETURN NULL;
  END IF;

  SELECT r.id INTO v_id
  FROM public.recursos r
  WHERE r.company_id = p_company_id
    AND (
      btrim(coalesce(r.dunasoft_codrec, '')) = v_codrec
      OR public.normalize_dunasoft_codrec(r.dunasoft_codrec) = v_norm
    )
    AND coalesce(r.activo, true)
  ORDER BY CASE WHEN btrim(coalesce(r.dunasoft_codrec, '')) = v_codrec THEN 0 ELSE 1 END
  LIMIT 1;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_agenda_recurso_for_dunasoft_codrec(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION dunasoft.style_recursos_apply_from_style(
  p_company_id uuid,
  p_accion text,
  p_codrec text,
  p_desrec text,
  p_obsoleto boolean DEFAULT false,
  p_colorpf bigint DEFAULT 0,
  p_colorpl bigint DEFAULT 0,
  p_sync_version bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_accion text := upper(btrim(coalesce(p_accion, 'UPSERT')));
  v_codrec text := btrim(coalesce(p_codrec, ''));
  v_nombre text := nullif(btrim(coalesce(p_desrec, '')), '');
  v_recurso_id uuid;
  v_color text;
BEGIN
  IF v_codrec = '' OR v_codrec = '0' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codrec vacío');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  v_color := coalesce(
    public.vfp_color_to_hex(p_colorpf),
    public.vfp_color_to_hex(p_colorpl),
    '#3B82F6'
  );

  SELECT r.id INTO v_recurso_id
  FROM public.recursos r
  WHERE r.company_id = p_company_id
    AND (
      btrim(coalesce(r.dunasoft_codrec, '')) = v_codrec
      OR public.normalize_dunasoft_codrec(r.dunasoft_codrec) = public.normalize_dunasoft_codrec(v_codrec)
    )
  LIMIT 1;

  IF v_accion IN ('DELETE', 'BAJA', 'BORRAR') THEN
    IF v_recurso_id IS NOT NULL THEN
      UPDATE public.recursos SET activo = false, updated_at = now() WHERE id = v_recurso_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'accion', 'DELETE', 'codrec', v_codrec, 'recurso_id', v_recurso_id);
  END IF;

  IF v_nombre IS NULL THEN
    v_nombre := v_codrec;
  END IF;

  IF v_recurso_id IS NULL THEN
    INSERT INTO public.recursos (
      company_id, nombre, descripcion, tipo, activo, color, match_keywords, dunasoft_codrec
    ) VALUES (
      p_company_id,
      v_nombre,
      v_nombre,
      'equipamiento',
      NOT coalesce(p_obsoleto, false),
      v_color,
      lower(replace(v_nombre, ' ', ',')),
      v_codrec
    )
    RETURNING id INTO v_recurso_id;
  ELSE
    UPDATE public.recursos SET
      nombre = v_nombre,
      descripcion = coalesce(descripcion, v_nombre),
      activo = NOT coalesce(p_obsoleto, false),
      color = coalesce(v_color, color),
      dunasoft_codrec = v_codrec,
      updated_at = now()
    WHERE id = v_recurso_id;
  END IF;

  PERFORM dunasoft.style_map_upsert(p_company_id, 'recurso', v_codrec, v_recurso_id, p_sync_version, 'style_to_suite');

  RETURN jsonb_build_object(
    'ok', true, 'accion', v_accion, 'codrec', v_codrec, 'recurso_id', v_recurso_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_recursos_apply_from_style(
  uuid, text, text, text, boolean, bigint, bigint, bigint
) TO service_role;

CREATE OR REPLACE FUNCTION public.sync_recursos_from_style(p_company_id uuid DEFAULT NULL)
RETURNS TABLE(inserted_count integer, updated_count integer, deactivated_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, legacy, dunasoft
AS $$
DECLARE
  v_company_id uuid := coalesce(p_company_id, public.get_user_company_id());
  v_inserted integer := 0;
  v_updated integer := 0;
  v_deactivated integer := 0;
  v_row record;
  v_result jsonb;
BEGIN
  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'No se pudo resolver la empresa para sincronizar recursos de Style';
  END IF;

  IF to_regclass('legacy.recursos') IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0;
    RETURN;
  END IF;

  FOR v_row IN
    SELECT DISTINCT ON (public.normalize_dunasoft_codrec(btrim(coalesce(r.codrec, ''))))
      btrim(coalesce(r.codrec, '')) AS codrec,
      nullif(btrim(coalesce(r.desrec, '')), '') AS desrec,
      upper(coalesce(nullif(btrim(r.obsoleto), ''), 'NO')) IN ('S', 'SI', '1', 'TRUE', 'T', 'Y', 'YES') AS obsoleto,
      coalesce(nullif(btrim(r.colorpf), '')::bigint, 0) AS colorpf,
      coalesce(nullif(btrim(r.colorpl), '')::bigint, 0) AS colorpl
    FROM legacy.recursos r
    WHERE btrim(coalesce(r.codrec, '')) <> ''
      AND btrim(coalesce(r.codrec, '')) <> '0'
    ORDER BY public.normalize_dunasoft_codrec(btrim(coalesce(r.codrec, ''))), r.imported_at DESC NULLS LAST
  LOOP
    v_result := dunasoft.style_recursos_apply_from_style(
      v_company_id,
      'UPSERT',
      v_row.codrec,
      coalesce(v_row.desrec, v_row.codrec),
      v_row.obsoleto,
      v_row.colorpf,
      v_row.colorpl,
      0
    );
    IF (v_result->>'recurso_id') IS NOT NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.recursos r
        WHERE r.id = (v_result->>'recurso_id')::uuid
          AND r.created_at > now() - interval '2 seconds'
      ) THEN
        v_inserted := v_inserted + 1;
      ELSE
        v_updated := v_updated + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_inserted, v_updated, v_deactivated;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sync_recursos_from_style(uuid) TO authenticated, service_role;

-- Bootstrap inicial desde legacy.recursos
SELECT public.sync_recursos_from_style('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid);

INSERT INTO dunasoft.style_sync_cursor (company_id, tabla, enabled)
VALUES ('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid, 'recursos', true)
ON CONFLICT (company_id, tabla) DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = now();
