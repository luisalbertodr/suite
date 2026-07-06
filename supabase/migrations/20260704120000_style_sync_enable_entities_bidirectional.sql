-- Activa sync bidireccional de entidades para Mar Lamas (host Style)
-- y enriquece outbound Suite→Style con líneas de venta/factura.

-- Empresa host Style ↔ Suite (María del Mar Lamas Pernas)
-- La SL estética (816af484) permanece desactivada para no duplicar maestros POS.
UPDATE dunasoft.style_sync_cursor
SET enabled = true, last_error = NULL, updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND tabla IN ('clientes', 'articulos', 'bonoscli', 'albcab', 'faccab', 'ciecab');

UPDATE dunasoft.style_sync_cursor
SET enabled = false, updated_at = now()
WHERE company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d';

-- ---------------------------------------------------------------------------
-- Suite → Style: ventas TPV con líneas (alblin)
-- ---------------------------------------------------------------------------
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
  IF NOT dunasoft.entity_sync_enabled(NEW.company_id, 'albcab') THEN
    RETURN NEW;
  END IF;
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
        'precio', CASE
          WHEN v_scale IS NULL THEN coalesce(si.unit_price, 0)
          ELSE coalesce(si.unit_price, 0) / v_scale
        END,
        'total', CASE
          WHEN v_scale IS NULL THEN coalesce(si.total_price, 0)
          ELSE coalesce(si.total_price, 0) / v_scale
        END
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

-- ---------------------------------------------------------------------------
-- Suite → Style: facturas nativas con líneas (faclin)
-- ---------------------------------------------------------------------------
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
  IF NOT dunasoft.entity_sync_enabled(NEW.company_id, 'faccab') THEN
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
