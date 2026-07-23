-- invoices_enqueue_style_sync: invoice_items no tiene article_id/tax_percent/sort_order.
-- Evita romper UPDATEs de customer_id (p.ej. merges de duplicados).

CREATE OR REPLACE FUNCTION public.invoices_enqueue_style_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, dunasoft
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
        'codart', '',
        'desart', coalesce(ii.description, ''),
        'cantidad', coalesce(ii.quantity, 1),
        'precio', CASE
          WHEN v_scale IS NULL THEN coalesce(ii.unit_price, 0)
          ELSE coalesce(ii.unit_price, 0) / v_scale
        END,
        'subtot', CASE
          WHEN v_scale IS NULL THEN coalesce(ii.total_price, 0)
          ELSE coalesce(ii.total_price, 0) / v_scale
        END,
        'taniva', coalesce(ii.iva_percentage, 21)
      )
      ORDER BY ii.created_at
    ),
    '[]'::jsonb
  )
  INTO v_lineas
  FROM public.invoice_items ii
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

COMMENT ON FUNCTION public.invoices_enqueue_style_sync() IS
  'Encola factura Suite→Style; líneas desde invoice_items (sin article_id).';
