-- Persistir CODEMP de Style en public.bonos y usarlo en incentivos.
-- El apply Style→Suite no guardaba la vendedora; dunasoft.bonoscli está
-- congelado en junio, así que jul-ago salían «sin asignar».

ALTER TABLE public.bonos
  ADD COLUMN IF NOT EXISTS legacy_codemp text,
  ADD COLUMN IF NOT EXISTS sold_by_employee_id uuid REFERENCES public.agenda_employees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bonos_sold_by_employee
  ON public.bonos (company_id, sold_by_employee_id, fecha_compra)
  WHERE sold_by_employee_id IS NOT NULL;

DROP FUNCTION IF EXISTS dunasoft.style_bonos_apply_from_style(
  uuid, text, text, text, text, text, numeric, numeric, numeric, date, date, boolean, bigint
);

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
  p_sync_version bigint DEFAULT 0,
  p_codemp     text DEFAULT NULL
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
  v_codemp text := nullif(btrim(coalesce(p_codemp, '')), '');
  v_scale numeric := dunasoft.style_price_scale(p_company_id);
  v_customer_id uuid;
  v_bono_id uuid;
  v_emp uuid;
  v_estado text := CASE WHEN coalesce(p_obsoleto, false) THEN 'inactivo' ELSE 'activo' END;
  v_nombre text := coalesce(nullif(btrim(coalesce(p_desbon, '')), ''), 'Bono ' || coalesce(nullif(btrim(coalesce(p_codbon, '')), ''), v_codboncli));
BEGIN
  IF v_codboncli = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'codboncli vacío');
  END IF;

  PERFORM set_config('dunasoft.in_style_apply', '1', true);

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

  IF v_codemp IS NOT NULL THEN
    v_emp := public.incentive_match_employee_codemp(p_company_id, v_codemp);
  END IF;

  IF v_bono_id IS NULL THEN
    INSERT INTO public.bonos (
      id, customer_id, company_id, nombre, descripcion,
      precio_total, sesiones_totales, sesiones_usadas, estado,
      fecha_compra, fecha_vencimiento, legacy_codboncli,
      legacy_codemp, sold_by_employee_id
    ) VALUES (
      gen_random_uuid(), v_customer_id, p_company_id, v_nombre, nullif(btrim(coalesce(p_desbon, '')), ''),
      coalesce(p_importe, 0) * v_scale,
      GREATEST(1, coalesce(p_sesiones, 1))::int,
      GREATEST(0, coalesce(p_consumidas, 0))::int,
      v_estado,
      coalesce(p_fecha, current_date), p_fecaducidad, v_codboncli,
      v_codemp, v_emp
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
      legacy_codemp = coalesce(v_codemp, legacy_codemp),
      sold_by_employee_id = coalesce(v_emp, sold_by_employee_id),
      updated_at = now()
    WHERE id = v_bono_id;
  END IF;

  PERFORM dunasoft.style_map_upsert(p_company_id, 'bono', v_codboncli, v_bono_id, p_sync_version, 'style_to_suite');

  RETURN jsonb_build_object(
    'ok', true,
    'accion', 'UPSERT',
    'codboncli', v_codboncli,
    'bono_id', v_bono_id,
    'codemp', v_codemp
  );
END;
$$;

GRANT EXECUTE ON FUNCTION dunasoft.style_bonos_apply_from_style(
  uuid, text, text, text, text, text, numeric, numeric, numeric, date, date, boolean, bigint, text
) TO service_role, postgres;

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
    NEW.company_id, 'bono',
    CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END,
    NEW.legacy_codboncli, NEW.id,
    jsonb_build_object(
      'codboncli', NEW.legacy_codboncli,
      'codcli', coalesce(v_codcli, ''),
      'desbon', NEW.nombre,
      'sesiones', NEW.sesiones_totales,
      'consumidas', NEW.sesiones_usadas,
      'codemp', coalesce(NEW.legacy_codemp, ''),
      'obsoleto', CASE WHEN NEW.estado = 'inactivo' THEN 'SI' ELSE 'NO' END
    )
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.incentive_bono_seller_codemp(p_legacy_codboncli text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft, legacy
AS $$
  SELECT coalesce(
    (
      SELECT nullif(btrim(b.legacy_codemp), '')
      FROM public.bonos b
      WHERE public.legacy_codcli_to_bigint(b.legacy_codboncli)
          = public.legacy_codcli_to_bigint(p_legacy_codboncli)
      ORDER BY b.updated_at DESC NULLS LAST
      LIMIT 1
    ),
    (
      SELECT nullif(btrim(x.codemp::text), '')
      FROM dunasoft.bonoscli x
      WHERE public.legacy_codcli_to_bigint(x.codboncli)
          = public.legacy_codcli_to_bigint(p_legacy_codboncli)
      LIMIT 1
    ),
    (
      SELECT nullif(btrim(x.codemp::text), '')
      FROM legacy.bonoscli x
      WHERE public.legacy_codcli_to_bigint(x.codboncli)
          = public.legacy_codcli_to_bigint(p_legacy_codboncli)
      LIMIT 1
    )
  );
$$;

CREATE OR REPLACE FUNCTION public.incentive_employee_sales_by_month(
  p_company_id uuid,
  p_employee_id uuid,
  p_from date
)
RETURNS TABLE (month date, amount_eur numeric, sales_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sold AS (
    SELECT
      date_trunc('month', b.fecha_compra)::date AS month,
      b.precio_total,
      coalesce(
        b.sold_by_employee_id,
        public.incentive_match_employee_codemp(
          b.company_id,
          coalesce(nullif(btrim(b.legacy_codemp), ''), public.incentive_bono_seller_codemp(b.legacy_codboncli))
        )
      ) AS employee_id
    FROM public.bonos b
    WHERE b.company_id = p_company_id
      AND b.fecha_compra >= p_from
      AND coalesce(b.precio_total, 0) >= coalesce(
        (SELECT s.min_eligible_amount FROM public.incentive_settings s WHERE s.company_id = p_company_id),
        100
      )
  )
  SELECT s.month,
         coalesce(sum(s.precio_total), 0)::numeric AS amount_eur,
         count(*)::integer AS sales_count
  FROM sold s
  WHERE s.employee_id = p_employee_id
  GROUP BY 1;
$$;

CREATE OR REPLACE FUNCTION public.incentive_unassigned_sales_by_month(
  p_company_id uuid,
  p_from date
)
RETURNS TABLE (month date, amount_eur numeric, sales_count integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH sold AS (
    SELECT
      date_trunc('month', b.fecha_compra)::date AS month,
      b.precio_total,
      coalesce(
        b.sold_by_employee_id,
        public.incentive_match_employee_codemp(
          b.company_id,
          coalesce(nullif(btrim(b.legacy_codemp), ''), public.incentive_bono_seller_codemp(b.legacy_codboncli))
        )
      ) AS employee_id
    FROM public.bonos b
    WHERE b.company_id = p_company_id
      AND b.fecha_compra >= p_from
      AND coalesce(b.precio_total, 0) >= coalesce(
        (SELECT s.min_eligible_amount FROM public.incentive_settings s WHERE s.company_id = p_company_id),
        100
      )
  )
  SELECT s.month,
         coalesce(sum(s.precio_total), 0)::numeric AS amount_eur,
         count(*)::integer AS sales_count
  FROM sold s
  WHERE s.employee_id IS NULL
  GROUP BY 1;
$$;

GRANT EXECUTE ON FUNCTION public.incentive_bono_seller_codemp(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_employee_sales_by_month(uuid, uuid, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.incentive_unassigned_sales_by_month(uuid, date) TO authenticated, service_role;

-- Bonos que aún existen en dunasoft/legacy (hasta junio): copiar vendedora ya conocida.
UPDATE public.bonos b
SET
  legacy_codemp = src.codemp,
  sold_by_employee_id = coalesce(
    b.sold_by_employee_id,
    public.incentive_match_employee_codemp(b.company_id, src.codemp)
  )
FROM (
  SELECT DISTINCT ON (k)
    k,
    codemp
  FROM (
    SELECT
      public.legacy_codcli_to_bigint(x.codboncli) AS k,
      1 AS pri,
      nullif(btrim(x.codemp::text), '') AS codemp
    FROM dunasoft.bonoscli x
    UNION ALL
    SELECT
      public.legacy_codcli_to_bigint(x.codboncli),
      2,
      nullif(btrim(x.codemp::text), '')
    FROM legacy.bonoscli x
  ) u
  WHERE u.codemp IS NOT NULL
    AND u.k IS NOT NULL
  ORDER BY k, pri
) src
WHERE public.legacy_codcli_to_bigint(b.legacy_codboncli) = src.k
  AND nullif(btrim(coalesce(b.legacy_codemp, '')), '') IS NULL;

-- Jul/ago viven solo en el DBF de Style. El poller no reescanea si el mtime
-- no cambia; al borrar huellas y reiniciar el agente (lastMtime vacío) reaplica
-- todas las filas con p_codemp. No dejar esto antes de desplegar el agente
-- nuevo: el poller viejo escribiría huellas sin CODEMP.
DELETE FROM dunasoft.style_sync_dbf_fingerprint
WHERE tabla = 'bonoscli';

NOTIFY pgrst, 'reload schema';
