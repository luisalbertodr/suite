-- Fase 5: Facturación (faccab/faclin) Style ↔ Suite.
--   Idempotencia estricta por clave (serie, numfac, codcli) → style_sync_entity_map (entity 'invoice').
--   Style → Suite: factura emitida en POS. Suite → Style: solo facturas Suite sin par Style.
--   Coordina con el histórico importado vía marcador en notes y el mapeo (no duplica).

CREATE OR REPLACE FUNCTION dunasoft.style_facturas_apply_from_style(
  p_company_id uuid,
  p_accion     text,
  p_numfac     text,
  p_serie      text,
  p_codcli     text,
  p_fecha      date,
  p_baseimp    numeric,
  p_iva        numeric,
  p_total      numeric,
  p_sync_version bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_accion text := upper(btrim(coalesce(p_accion, 'UPSERT')));
  v_numfac text := btrim(coalesce(p_numfac, ''));
  v_serie text := btrim(coalesce(p_serie, ''));
  v_codcli text := btrim(coalesce(p_codcli, ''));
  v_key text := v_serie || '/' || v_numfac || '/' || v_codcli;
  v_scale numeric := dunasoft.style_price_scale(p_company_id);
  v_subtotal numeric := coalesce(p_baseimp, 0) * v_scale;
  v_tax numeric := coalesce(p_iva, 0) * v_scale;
  v_total numeric := coalesce(p_total, 0) * v_scale;
  v_number text;
  v_customer_id uuid;
  v_invoice_id uuid;
BEGIN
  IF v_numfac = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'numfac vacío');
  END IF;
  v_number := coalesce(nullif(v_serie, ''), 'A') || '-' || v_numfac;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  v_customer_id := dunasoft.style_map_suite_id(p_company_id, 'customer', v_codcli);
  IF v_customer_id IS NULL AND v_codcli NOT IN ('', '0') THEN
    SELECT c.id INTO v_customer_id
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND public.legacy_codcli_to_bigint(c.legacy_codcli) = public.legacy_codcli_to_bigint(v_codcli)
    LIMIT 1;
  END IF;

  v_invoice_id := dunasoft.style_map_suite_id(p_company_id, 'invoice', v_key);
  IF v_invoice_id IS NULL THEN
    SELECT id INTO v_invoice_id
    FROM public.invoices
    WHERE company_id = p_company_id AND number = v_number
    LIMIT 1;
  END IF;

  IF v_accion IN ('DELETE', 'BAJA', 'BORRAR') THEN
    IF v_invoice_id IS NOT NULL THEN
      UPDATE public.invoices SET status = 'cancelled', updated_at = now() WHERE id = v_invoice_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'accion', 'DELETE', 'numfac', v_numfac, 'invoice_id', v_invoice_id);
  END IF;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cliente no resuelto para factura', 'codcli', v_codcli);
  END IF;

  IF v_invoice_id IS NULL THEN
    INSERT INTO public.invoices (
      id, company_id, customer_id, number, issue_date, due_date, status,
      subtotal, tax_amount, total_amount, notes
    ) VALUES (
      gen_random_uuid(), p_company_id, v_customer_id, v_number,
      coalesce(p_fecha, current_date), coalesce(p_fecha, current_date),
      'paid', v_subtotal, v_tax, v_total, 'Factura Style sync'
    )
    RETURNING id INTO v_invoice_id;
  ELSE
    UPDATE public.invoices SET
      customer_id = v_customer_id,
      issue_date = coalesce(p_fecha, issue_date),
      subtotal = v_subtotal,
      tax_amount = v_tax,
      total_amount = v_total,
      status = CASE WHEN status = 'cancelled' THEN 'paid' ELSE status END,
      updated_at = now()
    WHERE id = v_invoice_id;
  END IF;

  PERFORM dunasoft.style_map_upsert(p_company_id, 'invoice', v_key, v_invoice_id, p_sync_version, 'style_to_suite');

  RETURN jsonb_build_object('ok', true, 'accion', 'UPSERT', 'numfac', v_numfac, 'invoice_id', v_invoice_id);
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_facturas_apply_from_style(
  uuid, text, text, text, text, date, numeric, numeric, numeric, bigint
) TO service_role;

-- ---------------------------------------------------------------------------
-- Suite → Style: solo facturas generadas en Suite sin par Style ni histórico legacy
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invoices_enqueue_style_sync()
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
  IF NOT dunasoft.entity_sync_enabled(NEW.company_id, 'faccab') THEN
    RETURN NEW;
  END IF;
  -- Excluir facturas que ya proceden de Style o del import histórico.
  IF coalesce(NEW.notes, '') ILIKE '%Factura Style sync%'
     OR coalesce(NEW.notes, '') ILIKE '%Factura legacy autom%' THEN
    RETURN NEW;
  END IF;
  -- Solo si ya existe un mapeo no la reenviamos (idempotencia).
  IF dunasoft.style_map_style_key(NEW.company_id, 'invoice', NEW.id) IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT legacy_codcli INTO v_codcli FROM public.customers WHERE id = NEW.customer_id;

  PERFORM dunasoft.enqueue_style_entity(
    NEW.company_id, 'invoice', 'create', NEW.number, NEW.id,
    jsonb_build_object(
      'numfac', NEW.number,
      'codcli', coalesce(v_codcli, ''),
      'fecha', to_char(NEW.issue_date, 'YYYY-MM-DD'),
      'baseimp', NEW.subtotal,
      'iva', NEW.tax_amount,
      'total', NEW.total_amount
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS invoices_enqueue_style_sync ON public.invoices;
CREATE TRIGGER invoices_enqueue_style_sync
  AFTER INSERT OR UPDATE ON public.invoices
  FOR EACH ROW
  EXECUTE FUNCTION public.invoices_enqueue_style_sync();

INSERT INTO dunasoft.style_sync_cursor (company_id, tabla, enabled)
SELECT id, 'faccab', false FROM public.companies
ON CONFLICT (company_id, tabla) DO NOTHING;
