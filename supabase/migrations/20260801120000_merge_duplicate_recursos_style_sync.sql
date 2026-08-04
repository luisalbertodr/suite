-- Merge recursos Suite duplicados con Style/Dunasoft y endurece el sync Style→Suite.
-- Conserva el recurso con dunasoft_codrec (origen Style) y fusiona keywords/artículos del duplicado manual.

CREATE OR REPLACE FUNCTION public.merge_recurso_into(
  p_keep_id uuid,
  p_drop_id uuid,
  p_extra_keywords text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_keep public.recursos%ROWTYPE;
  v_drop public.recursos%ROWTYPE;
  v_keywords text;
  v_parts text[];
BEGIN
  IF p_keep_id IS NULL OR p_drop_id IS NULL OR p_keep_id = p_drop_id THEN
    RETURN;
  END IF;

  SELECT * INTO v_keep FROM public.recursos WHERE id = p_keep_id;
  SELECT * INTO v_drop FROM public.recursos WHERE id = p_drop_id;
  IF v_keep.id IS NULL OR v_drop.id IS NULL THEN
    RETURN;
  END IF;
  IF v_keep.company_id IS DISTINCT FROM v_drop.company_id THEN
    RAISE EXCEPTION 'merge_recurso_into: company_id distinto';
  END IF;

  -- Reasignar FKs
  UPDATE public.articles SET recurso_id = p_keep_id WHERE recurso_id = p_drop_id;
  UPDATE public.appointment_items SET recurso_id = p_keep_id WHERE recurso_id = p_drop_id;
  UPDATE public.appointment_resources SET recurso_id = p_keep_id WHERE recurso_id = p_drop_id;

  -- Fusionar keywords (keep + drop + extras), sin duplicar
  v_parts := ARRAY[]::text[];
  FOREACH v_keywords IN ARRAY ARRAY[
    coalesce(v_keep.match_keywords, ''),
    coalesce(v_drop.match_keywords, ''),
    coalesce(p_extra_keywords, ''),
    coalesce(v_drop.nombre, '')
  ]
  LOOP
    v_parts := v_parts || string_to_array(lower(replace(btrim(v_keywords), ' ', ',')), ',');
  END LOOP;

  SELECT string_agg(DISTINCT btrim(p), ',' ORDER BY btrim(p))
  INTO v_keywords
  FROM unnest(v_parts) AS p
  WHERE btrim(p) <> '' AND length(btrim(p)) > 1;

  UPDATE public.recursos SET
    match_keywords = coalesce(nullif(v_keywords, ''), match_keywords),
    descripcion = coalesce(nullif(btrim(descripcion), ''), v_drop.descripcion, descripcion),
    cabina_id = coalesce(cabina_id, v_drop.cabina_id),
    -- Preferir color Style (keep) si es válido; si no, el del drop
    color = CASE
      WHEN color ~ '^#[0-9A-Fa-f]{6}$' THEN color
      WHEN v_drop.color ~ '^#[0-9A-Fa-f]{6}$' THEN v_drop.color
      ELSE color
    END,
    updated_at = now()
  WHERE id = p_keep_id;

  UPDATE public.recursos SET
    activo = false,
    updated_at = now()
  WHERE id = p_drop_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.merge_recurso_into(uuid, uuid, text) TO service_role;

DO $$
DECLARE
  v_company uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid;
BEGIN
  -- Exact name duplicates: keep Style-linked, drop manual
  PERFORM public.merge_recurso_into(
    '7406fbf3-1066-4a06-b76a-8ecf282df5fe'::uuid, -- INDIBA (Style)
    '60839eae-26c0-42bc-ab6d-68ddb184a737'::uuid, -- Indiba manual
    'radiofrecuencia,capacitiva,resistiva'
  );
  PERFORM public.merge_recurso_into(
    '0cf544c2-b073-457f-838d-2b70ad9e3d71'::uuid, -- LED SKYMEDIC (Style)
    '15db40b8-acd3-4aa9-84cc-b28c61ab0fd9'::uuid  -- LED Skymedic manual
  );
  PERFORM public.merge_recurso_into(
    '9db3c1e2-c907-46d5-8fd4-90f7855c8256'::uuid, -- LPG (Style)
    'b1567f4f-549f-46f7-ae33-159b222e360a'::uuid, -- LPG manual
    'endermologie,maderoterapia'
  );

  -- Near-duplicates vs Style
  PERFORM public.merge_recurso_into(
    'a98973bb-b572-433a-bf1c-d2207083f6ed'::uuid, -- Depilacion electrica (Style)
    '3454269d-265e-4a4c-8c2a-1a27a225a5e6'::uuid, -- Dep Eléctrica manual
    'dep electrica,depilacion electrica,electrica'
  );
  PERFORM public.merge_recurso_into(
    'a944323d-9b31-489d-a6cb-c6a811f802b0'::uuid, -- LASERME (Style / Neauvia)
    'a2f1a77b-2ba8-4a8b-b933-d06bc688bb22'::uuid, -- LáserME manual
    'laserme,neauvia'
  );
  PERFORM public.merge_recurso_into(
    'a6399800-5ca2-4339-8047-af68418c472b'::uuid, -- MICRO (Style)
    'e213e024-7227-4595-ac76-c61629a38d0e'::uuid, -- Microneedling manual
    'microneedling,micro needling,micro'
  );

  -- IPL-Láser manual → fusionar keywords en IPL y LASER Style, luego desactivar
  PERFORM public.merge_recurso_into(
    '2f52b770-bd43-4345-9770-a686bd88aaed'::uuid, -- IPL
    '6da06074-ba13-42c4-a4d1-7e24abe4f40b'::uuid, -- IPL-Láser
    'laser,láser,diodo,lumbar,dorsal,axila,pierna,ipl'
  );
  -- Ampliar keywords de LASER con las mismas pistas (sin drop adicional)
  UPDATE public.recursos SET
    match_keywords = (
      SELECT string_agg(DISTINCT btrim(p), ',' ORDER BY btrim(p))
      FROM unnest(string_to_array(lower(replace(
        coalesce(match_keywords,'') || ',laser,láser,ipl,diodo,lumbar,dorsal,axila,pierna',
        ' ', ','
      )), ',')) AS p
      WHERE btrim(p) <> '' AND length(btrim(p)) > 1
    ),
    updated_at = now()
  WHERE id = '28d11474-0921-4884-b191-c29afd80d727'::uuid
    AND company_id = v_company;
END;
$$;

-- Endurecer sync Style→Suite: emparejar también por nombre normalizado y preservar keywords.
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
  v_nombre_norm text;
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

  v_nombre_norm := lower(btrim(coalesce(v_nombre, '')));

  -- 1) Match por codrec
  SELECT r.id INTO v_recurso_id
  FROM public.recursos r
  WHERE r.company_id = p_company_id
    AND (
      btrim(coalesce(r.dunasoft_codrec, '')) = v_codrec
      OR public.normalize_dunasoft_codrec(r.dunasoft_codrec) = public.normalize_dunasoft_codrec(v_codrec)
    )
  ORDER BY CASE WHEN btrim(coalesce(r.dunasoft_codrec, '')) = v_codrec THEN 0 ELSE 1 END,
           coalesce(r.activo, true) DESC,
           r.created_at
  LIMIT 1;

  -- 2) Si no hay codrec, emparejar recurso manual activo con mismo nombre (evita duplicados)
  IF v_recurso_id IS NULL AND v_nombre_norm <> '' THEN
    SELECT r.id INTO v_recurso_id
    FROM public.recursos r
    WHERE r.company_id = p_company_id
      AND coalesce(r.activo, true)
      AND (r.dunasoft_codrec IS NULL OR btrim(r.dunasoft_codrec) = '')
      AND lower(btrim(r.nombre)) = v_nombre_norm
    ORDER BY r.created_at
    LIMIT 1;
  END IF;

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
      descripcion = coalesce(nullif(btrim(descripcion), ''), v_nombre),
      activo = NOT coalesce(p_obsoleto, false),
      color = coalesce(v_color, color),
      -- Preservar keywords locales más ricas; solo rellenar si faltan
      match_keywords = CASE
        WHEN nullif(btrim(coalesce(match_keywords, '')), '') IS NOT NULL THEN match_keywords
        ELSE lower(replace(v_nombre, ' ', ','))
      END,
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

-- Índice único parcial: un solo recurso activo por codrec normalizado y empresa
CREATE UNIQUE INDEX IF NOT EXISTS uq_recursos_company_dunasoft_codrec_norm
  ON public.recursos (company_id, (public.normalize_dunasoft_codrec(dunasoft_codrec)))
  WHERE dunasoft_codrec IS NOT NULL
    AND btrim(dunasoft_codrec) <> ''
    AND coalesce(activo, true);
