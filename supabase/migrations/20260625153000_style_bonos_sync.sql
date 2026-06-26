-- Fase 3: Bonos de cliente (bonoscli) Style ↔ Suite.
--   Style → Suite: saldo/consumo (sesiones_usadas) gana desde Style.
--   Suite → Style: consumo registrado en Suite notifica a Style (incrementa consumi).
--   Mapeo: legacy_codboncli ↔ public.bonos.id.

CREATE OR REPLACE FUNCTION dunasoft.style_bonos_apply_from_style(
  p_company_id uuid,
  p_accion     text,
  p_codboncli  text,
  p_codcli     text,
  p_codbon     text,
  p_desbon     text,
  p_sesiones   numeric,
  p_consumidas numeric,
  p_importe    numeric,
  p_fecha      date,
  p_fecaducidad date,
  p_obsoleto   boolean,
  p_sync_version bigint DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = dunasoft, public
AS $$
DECLARE
  v_accion text := upper(btrim(coalesce(p_accion, 'UPSERT')));
  v_codboncli text := btrim(coalesce(p_codboncli, ''));
  v_codcli text := btrim(coalesce(p_codcli, ''));
  v_scale numeric := dunasoft.style_price_scale(p_company_id);
  v_customer_id uuid;
  v_bono_id uuid;
  v_estado text := CASE WHEN coalesce(p_obsoleto, false) THEN 'inactivo' ELSE 'activo' END;
  v_nombre text := coalesce(nullif(btrim(coalesce(p_desbon, '')), ''), 'Bono ' || coalesce(nullif(btrim(coalesce(p_codbon, '')), ''), v_codboncli));
BEGIN
  IF v_codboncli = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codboncli vacío');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

  -- Resolver cliente (FK obligatoria en public.bonos).
  v_customer_id := dunasoft.style_map_suite_id(p_company_id, 'customer', v_codcli);
  IF v_customer_id IS NULL AND v_codcli <> '' THEN
    SELECT c.id INTO v_customer_id
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND public.legacy_codcli_to_bigint(c.legacy_codcli) = public.legacy_codcli_to_bigint(v_codcli)
    LIMIT 1;
  END IF;

  v_bono_id := dunasoft.style_map_suite_id(p_company_id, 'bono', v_codboncli);
  IF v_bono_id IS NULL THEN
    SELECT id INTO v_bono_id
    FROM public.bonos
    WHERE company_id = p_company_id AND legacy_codboncli = v_codboncli
    LIMIT 1;
  END IF;

  IF v_accion IN ('DELETE', 'BAJA', 'BORRAR') THEN
    IF v_bono_id IS NOT NULL THEN
      UPDATE public.bonos SET estado = 'inactivo', updated_at = now() WHERE id = v_bono_id;
    END IF;
    RETURN jsonb_build_object('ok', true, 'accion', 'DELETE', 'codboncli', v_codboncli, 'bono_id', v_bono_id);
  END IF;

  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'cliente no resuelto para bono', 'codcli', v_codcli);
  END IF;

  IF v_bono_id IS NULL THEN
    INSERT INTO public.bonos (
      id, customer_id, company_id, nombre, descripcion,
      precio_total, sesiones_totales, sesiones_usadas, estado,
      fecha_compra, fecha_vencimiento, legacy_codboncli
    ) VALUES (
      gen_random_uuid(), v_customer_id, p_company_id, v_nombre, nullif(btrim(coalesce(p_desbon, '')), ''),
      coalesce(p_importe, 0) * v_scale,
      GREATEST(1, coalesce(p_sesiones, 1))::int,
      GREATEST(0, coalesce(p_consumidas, 0))::int,
      v_estado,
      coalesce(p_fecha, current_date), p_fecaducidad, v_codboncli
    )
    RETURNING id INTO v_bono_id;
  ELSE
    UPDATE public.bonos SET
      customer_id = v_customer_id,
      nombre = v_nombre,
      precio_total = coalesce(p_importe, 0) * v_scale,
      sesiones_totales = GREATEST(coalesce(p_sesiones, sesiones_totales), coalesce(p_consumidas, 0))::int,
      sesiones_usadas = GREATEST(0, coalesce(p_consumidas, sesiones_usadas))::int,
      estado = v_estado,
      fecha_compra = coalesce(p_fecha, fecha_compra),
      fecha_vencimiento = coalesce(p_fecaducidad, fecha_vencimiento),
      updated_at = now()
    WHERE id = v_bono_id;
  END IF;

  PERFORM dunasoft.style_map_upsert(p_company_id, 'bono', v_codboncli, v_bono_id, p_sync_version, 'style_to_suite');

  RETURN jsonb_build_object('ok', true, 'accion', 'UPSERT', 'codboncli', v_codboncli, 'bono_id', v_bono_id);
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_bonos_apply_from_style(
  uuid, text, text, text, text, text, numeric, numeric, numeric, date, date, boolean, bigint
) TO service_role;

-- ---------------------------------------------------------------------------
-- Suite → Style: alta/consumo de bono → incrementa saldo en bonoscli.dbf
-- ---------------------------------------------------------------------------
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
  IF NOT dunasoft.entity_sync_enabled(NEW.company_id, 'bonoscli') THEN
    RETURN NEW;
  END IF;
  -- Solo bonos con clave Style (el alta nativa Suite sin código no va al POS aún).
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

DROP TRIGGER IF EXISTS bonos_enqueue_style_sync ON public.bonos;
CREATE TRIGGER bonos_enqueue_style_sync
  AFTER INSERT OR UPDATE ON public.bonos
  FOR EACH ROW
  EXECUTE FUNCTION public.bonos_enqueue_style_sync();

INSERT INTO dunasoft.style_sync_cursor (company_id, tabla, enabled)
SELECT id, 'bonoscli', false FROM public.companies
ON CONFLICT (company_id, tabla) DO NOTHING;
