-- Fase 4: Ventas TPV (albcab/alblin) Style ↔ Suite — mayor riesgo en doble operación.
--   Idempotencia por clave compuesta (serie/numalb) en style_sync_entity_map (entity 'sale').
--   ticket_number determinista 'STY-<serie>-<numalb>' evita duplicar revenue con TPV-*/LEG-*.
--   Style → Suite: alta/actualización de ticket. Suite → Style: solo tickets TPV-* nativos.

CREATE OR REPLACE FUNCTION dunasoft.style_ventas_apply_from_style(
  p_company_id uuid,
  p_accion     text,
  p_numalb     text,
  p_serie      text,
  p_codcli     text,
  p_fecha      date,
  p_total      numeric,
  p_lineas     text DEFAULT '[]',
  p_sync_version bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_accion text := upper(btrim(coalesce(p_accion, 'UPSERT')));
  v_numalb text := btrim(coalesce(p_numalb, ''));
  v_serie text := btrim(coalesce(p_serie, ''));
  v_key text := v_serie || '/' || v_numalb;
  v_scale numeric := dunasoft.style_price_scale(p_company_id);
  v_total numeric := coalesce(p_total, 0) * v_scale;
  v_ticket text := 'STY-' || nullif(v_serie, '') || '-' || v_numalb;
  v_customer_id uuid;
  v_customer_name text;
  v_sale_id uuid;
  v_subtotal numeric := round(v_total / 1.21, 2);
  v_tax numeric := round(v_total - round(v_total / 1.21, 2), 2);
  v_lines jsonb;
  v_line jsonb;
BEGIN
  IF v_numalb = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'numalb vacío');
  END IF;
  v_ticket := 'STY-' || coalesce(nullif(v_serie, ''), '0') || '-' || v_numalb;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  -- Cliente (opcional en ventas de contado).
  v_customer_id := dunasoft.style_map_suite_id(p_company_id, 'customer', btrim(coalesce(p_codcli, '')));
  IF v_customer_id IS NULL AND btrim(coalesce(p_codcli, '')) NOT IN ('', '0') THEN
    SELECT c.id, c.name INTO v_customer_id, v_customer_name
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND public.legacy_codcli_to_bigint(c.legacy_codcli) = public.legacy_codcli_to_bigint(p_codcli)
    LIMIT 1;
  ELSIF v_customer_id IS NOT NULL THEN
    SELECT name INTO v_customer_name FROM public.customers WHERE id = v_customer_id;
  END IF;

  v_sale_id := dunasoft.style_map_suite_id(p_company_id, 'sale', v_key);
  IF v_sale_id IS NULL THEN
    SELECT id INTO v_sale_id
    FROM public.sales
    WHERE company_id = p_company_id AND ticket_number = v_ticket
    LIMIT 1;
  END IF;

  IF v_accion IN ('DELETE', 'BAJA', 'BORRAR') THEN
    IF v_sale_id IS NOT NULL THEN
      UPDATE public.sales SET status = 'cancelled', updated_at = now() WHERE id = v_sale_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'accion', 'DELETE', 'numalb', v_numalb, 'sale_id', v_sale_id);
  END IF;

  IF v_sale_id IS NULL THEN
    INSERT INTO public.sales (
      id, company_id, ticket_number, total_amount, subtotal, tax_amount,
      payment_method, status, customer_id, customer_name, created_at
    ) VALUES (
      gen_random_uuid(), p_company_id, v_ticket, v_total, v_subtotal, v_tax,
      'cash', 'completed', v_customer_id, v_customer_name,
      coalesce(p_fecha::timestamptz, now())
    )
    RETURNING id INTO v_sale_id;
  ELSE
    UPDATE public.sales SET
      total_amount = v_total,
      subtotal = v_subtotal,
      tax_amount = v_tax,
      customer_id = coalesce(v_customer_id, customer_id),
      customer_name = coalesce(v_customer_name, customer_name),
      status = CASE WHEN status = 'cancelled' THEN 'completed' ELSE status END,
      updated_at = now()
    WHERE id = v_sale_id;
  END IF;

  -- Líneas (alblin) si el agente las transporta como JSON [{codart,desart,cantidad,precio,total}].
  v_lines := NULLIF(btrim(coalesce(p_lineas, '')), '')::jsonb;
  IF v_lines IS NOT NULL AND jsonb_typeof(v_lines) = 'array' AND jsonb_array_length(v_lines) > 0 THEN
    DELETE FROM public.sale_items WHERE sale_id = v_sale_id;
    FOR v_line IN SELECT * FROM jsonb_array_elements(v_lines) LOOP
      INSERT INTO public.sale_items (sale_id, article_id, description, quantity, unit_price, total_price)
      VALUES (
        v_sale_id,
        (SELECT id FROM public.articles
          WHERE company_id = p_company_id
            AND legacy_codart = btrim(coalesce(v_line->>'codart', '')) LIMIT 1),
        coalesce(v_line->>'desart', v_line->>'codart', ''),
        coalesce((v_line->>'cantidad')::numeric, 1),
        coalesce((v_line->>'precio')::numeric, 0) * v_scale,
        coalesce((v_line->>'total')::numeric, 0) * v_scale
      );
    END LOOP;
  END IF;

  PERFORM dunasoft.style_map_upsert(p_company_id, 'sale', v_key, v_sale_id, p_sync_version, 'style_to_suite');

  RETURN jsonb_build_object('ok', true, 'accion', 'UPSERT', 'numalb', v_numalb, 'sale_id', v_sale_id);
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_ventas_apply_from_style(
  uuid, text, text, text, text, date, numeric, text, bigint
) TO service_role;

-- ---------------------------------------------------------------------------
-- Suite → Style: solo tickets TPV nativos (no STY-/LEG-) → albcab
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sales_enqueue_style_sync()
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
  IF NOT dunasoft.entity_sync_enabled(NEW.company_id, 'albcab') THEN
    RETURN NEW;
  END IF;
  -- No reenviar a Style ventas que ya proceden de Style o del histórico legacy.
  IF NEW.ticket_number IS NULL OR NEW.ticket_number !~ '^TPV-' THEN
    RETURN NEW;
  END IF;
  IF NEW.status <> 'completed' THEN
    RETURN NEW;
  END IF;

  SELECT legacy_codcli INTO v_codcli FROM public.customers WHERE id = NEW.customer_id;

  PERFORM dunasoft.enqueue_style_entity(
    NEW.company_id, 'sale', 'create', NEW.ticket_number, NEW.id,
    jsonb_build_object(
      'ticket', NEW.ticket_number,
      'codcli', coalesce(v_codcli, ''),
      'fecha', to_char(NEW.created_at, 'YYYY-MM-DD'),
      'total', NEW.total_amount
    )
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sales_enqueue_style_sync ON public.sales;
CREATE TRIGGER sales_enqueue_style_sync
  AFTER INSERT OR UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.sales_enqueue_style_sync();

INSERT INTO dunasoft.style_sync_cursor (company_id, tabla, enabled)
SELECT id, 'albcab', false FROM public.companies
ON CONFLICT (company_id, tabla) DO NOTHING;
