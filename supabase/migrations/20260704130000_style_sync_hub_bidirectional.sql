-- Style es instancia única: Suite→Style de AMBAS empresas se encola en el hub (host Style).
-- Style→Suite sigue leyendo cola_sincro.dbf con el agente en COMPANY_ID = hub.
-- Transición: ventas/facturas Suite (TPV nativas) → Style para cuadre; Style sigue contabilizando lo suyo.

-- Hub = empresa anfitriona del agente / Style-Dunasoft (María del Mar Lamas Pernas).
CREATE OR REPLACE FUNCTION dunasoft.style_sync_hub_company_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid;
$$;

COMMENT ON FUNCTION dunasoft.style_sync_hub_company_id IS
  'UUID empresa Suite anclada al agente Style (instancia única VFP). Outbound Suite→Style usa este hub.';

-- Style → Suite: cursor del hub (cola_sincro física en Style).
CREATE OR REPLACE FUNCTION dunasoft.style_to_suite_enabled(p_tabla text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT dunasoft.entity_sync_enabled(dunasoft.style_sync_hub_company_id(), p_tabla);
$$;

-- Suite → Style: habilitado si el hub tiene la tabla activa (independiente de company_id origen).
CREATE OR REPLACE FUNCTION dunasoft.suite_to_style_enabled(p_tabla text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
  SELECT dunasoft.entity_sync_enabled(dunasoft.style_sync_hub_company_id(), p_tabla);
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_sync_hub_company_id() TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION dunasoft.style_to_suite_enabled(text) TO service_role, authenticated;
GRANT EXECUTE ON FUNCTION dunasoft.suite_to_style_enabled(text) TO service_role, authenticated;

-- ---------------------------------------------------------------------------
-- Outbox: siempre company_id = hub; origen Suite en payload.suite_company_id
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.enqueue_style_entity(
  p_company_id  uuid,
  p_entity_type text,
  p_operation   text,
  p_style_key   text,
  p_suite_id    uuid,
  p_payload     jsonb
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_id bigint;
  v_ver bigint;
  v_hub uuid := dunasoft.style_sync_hub_company_id();
BEGIN
  v_ver := coalesce(
    (SELECT sync_version FROM dunasoft.style_sync_entity_map m
      WHERE m.company_id = p_company_id AND m.entity_type = p_entity_type
        AND m.suite_id = p_suite_id
      LIMIT 1),
    (SELECT sync_version FROM dunasoft.style_sync_entity_map m
      WHERE m.company_id = p_company_id AND m.entity_type = p_entity_type
        AND m.style_key = btrim(coalesce(p_style_key, ''))
      LIMIT 1),
    0
  ) + 1;

  INSERT INTO dunasoft.style_sync_outbox (
    company_id, entity_type, operation, style_key, suite_id, payload
  ) VALUES (
    v_hub, p_entity_type, p_operation,
    NULLIF(btrim(coalesce(p_style_key, '')), ''), p_suite_id,
    coalesce(p_payload, '{}'::jsonb)
      || jsonb_build_object(
           'sync_version', v_ver,
           'suite_company_id', p_company_id
         )
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Agenda Suite→Style: cola en hub; origen en payload
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION dunasoft.enqueue_style_reservas(
  p_company_id uuid,
  p_operation text,
  p_idplan numeric,
  p_payload jsonb,
  p_suite_appointment_id uuid DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_id bigint;
  v_hub uuid := dunasoft.style_sync_hub_company_id();
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.style_reservas_sync_config c
    WHERE c.company_id = p_company_id AND c.sync_enabled
  ) THEN
    RETURN NULL;
  END IF;

  INSERT INTO dunasoft.style_reservas_queue (
    company_id, operation, idplan, payload, suite_appointment_id
  ) VALUES (
    v_hub, p_operation, p_idplan,
    coalesce(p_payload, '{}'::jsonb) || jsonb_build_object('suite_company_id', p_company_id),
    p_suite_appointment_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Segunda empresa Suite: agenda bidireccional hacia Style (misma instancia VFP).
INSERT INTO public.style_reservas_sync_config (company_id, sync_token, macand, sync_enabled)
VALUES (
  '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid,
  encode(gen_random_bytes(24), 'hex'),
  'SUITE-STYLE-EST',
  true
)
ON CONFLICT (company_id) DO UPDATE SET
  sync_enabled = true,
  macand = EXCLUDED.macand;

-- ---------------------------------------------------------------------------
-- Triggers Suite → Style: cualquier empresa Suite si hub habilitado
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
  IF current_setting('dunasoft.in_style_apply', true) = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NOT dunasoft.suite_to_style_enabled('clientes') THEN
    RETURN NEW;
  END IF;

  v_op := CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END;

  PERFORM dunasoft.enqueue_style_entity(
    NEW.company_id, 'customer', v_op, NEW.legacy_codcli, NEW.id,
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
    NEW.company_id, 'bono', 'update', NEW.legacy_codboncli, NEW.id,
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

CREATE OR REPLACE FUNCTION public.sales_enqueue_style_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_codcli text;
  v_lineas jsonb;
  v_scale numeric;
BEGIN
  IF current_setting('dunasoft.in_style_apply', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NOT dunasoft.suite_to_style_enabled('albcab') THEN
    RETURN NEW;
  END IF;
  -- Solo ventas nativas Suite (TPV-*). Excluye STY-* replicadas desde Style.
  IF NEW.ticket_number IS NULL OR NEW.ticket_number !~ '^TPV-' THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT legacy_codcli INTO v_codcli FROM public.customers WHERE id = NEW.customer_id;
  v_scale := NULLIF(dunasoft.style_price_scale(NEW.company_id), 0);

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'codart', coalesce(a.legacy_codart, ''),
        'desart', coalesce(si.description, a.descripcion, ''),
        'cantidad', coalesce(si.quantity, 1),
        'precio', CASE WHEN v_scale IS NULL THEN coalesce(si.unit_price, 0) ELSE coalesce(si.unit_price, 0) / v_scale END,
        'total', CASE WHEN v_scale IS NULL THEN coalesce(si.total_price, 0) ELSE coalesce(si.total_price, 0) / v_scale END
      )
      ORDER BY si.created_at
    ),
    '[]'::jsonb
  )
  INTO v_lineas
  FROM public.sale_items si
  LEFT JOIN public.articles a ON a.id = si.article_id
  WHERE si.sale_id = NEW.id;

  PERFORM dunasoft.enqueue_style_entity(
    NEW.company_id, 'sale', 'create', NEW.ticket_number, NEW.id,
    jsonb_build_object(
      'ticket', NEW.ticket_number,
      'codcli', coalesce(v_codcli, ''),
      'fecha', to_char(NEW.created_at, 'YYYY-MM-DD'),
      'total', NEW.total_amount,
      'lineas', coalesce(v_lineas, '[]'::jsonb)
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.invoices_enqueue_style_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_codcli text;
  v_lineas jsonb;
  v_scale numeric;
BEGIN
  IF current_setting('dunasoft.in_style_apply', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NOT dunasoft.suite_to_style_enabled('faccab') THEN
    RETURN NEW;
  END IF;
  IF coalesce(NEW.notes, '') ILIKE '%Factura Style sync%'
     OR coalesce(NEW.notes, '') ILIKE '%Factura legacy autom%' THEN
    RETURN NEW;
  END IF;
  IF dunasoft.style_map_style_key(NEW.company_id, 'invoice', NEW.id) IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT legacy_codcli INTO v_codcli FROM public.customers WHERE id = NEW.customer_id;
  v_scale := NULLIF(dunasoft.style_price_scale(NEW.company_id), 0);

  SELECT coalesce(
    jsonb_agg(
      jsonb_build_object(
        'codart', coalesce(a.legacy_codart, ''),
        'desart', coalesce(ii.description, a.descripcion, ''),
        'cantidad', coalesce(ii.quantity, 1),
        'precio', CASE WHEN v_scale IS NULL THEN coalesce(ii.unit_price, 0) ELSE coalesce(ii.unit_price, 0) / v_scale END,
        'subtot', CASE WHEN v_scale IS NULL THEN coalesce(ii.total_price, 0) ELSE coalesce(ii.total_price, 0) / v_scale END,
        'taniva', coalesce(ii.tax_percent, 21)
      )
      ORDER BY ii.sort_order, ii.created_at
    ),
    '[]'::jsonb
  )
  INTO v_lineas
  FROM public.invoice_items ii
  LEFT JOIN public.articles a ON a.id = ii.article_id
  WHERE ii.invoice_id = NEW.id;

  PERFORM dunasoft.enqueue_style_entity(
    NEW.company_id, 'invoice', 'create', NEW.number, NEW.id,
    jsonb_build_object(
      'numfac', NEW.number,
      'codcli', coalesce(v_codcli, ''),
      'fecha', to_char(NEW.issue_date, 'YYYY-MM-DD'),
      'baseimp', NEW.subtotal,
      'iva', NEW.tax_amount,
      'total', NEW.total_amount,
      'lineas', coalesce(v_lineas, '[]'::jsonb)
    )
  );
  RETURN NEW;
END;
$$;

-- Caja Suite → Style
CREATE OR REPLACE FUNCTION public.cash_session_enqueue_style_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
BEGIN
  IF current_setting('dunasoft.in_style_apply', true) = '1' THEN
    RETURN NEW;
  END IF;
  IF NOT dunasoft.suite_to_style_enabled('ciecab') THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'closed' THEN
    RETURN NEW;
  END IF;
  IF dunasoft.style_map_style_key(NEW.company_id, 'cash_session', NEW.id) IS NOT NULL THEN
    RETURN NEW;
  END IF;

  PERFORM dunasoft.enqueue_style_entity(
    NEW.company_id, 'cash_session', 'create', NULL, NEW.id,
    jsonb_build_object(
      'fecha', to_char(NEW.session_date, 'YYYY-MM-DD'),
      'efectivo', coalesce(NEW.counted_cash, NEW.expected_cash, 0),
      'tarjeta', coalesce(NEW.counted_card, NEW.expected_card, 0),
      'total', coalesce(NEW.closing_cash, 0)
    )
  );
  RETURN NEW;
END;
$$;

-- Cursores: hub activo (Style→Suite + gate Suite→Style). SL sin cursor propio (no duplica maestros POS).
UPDATE dunasoft.style_sync_cursor
SET enabled = true, last_error = NULL, updated_at = now()
WHERE company_id = dunasoft.style_sync_hub_company_id()
  AND tabla IN ('clientes', 'articulos', 'bonoscli', 'albcab', 'faccab', 'ciecab');

UPDATE dunasoft.style_sync_cursor
SET enabled = false, updated_at = now()
WHERE company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d';
