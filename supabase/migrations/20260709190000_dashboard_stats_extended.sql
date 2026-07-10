-- Dashboard: clientes nuevos por mes/año (Style fecalta) y bonos vendidos por empleada.

CREATE OR REPLACE FUNCTION public.count_style_new_customers_for_month(
  p_catalog_company_id uuid,
  p_year int,
  p_month int
)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, legacy, dunasoft
AS $$
DECLARE
  v_month_start date;
  v_hub_id uuid;
BEGIN
  PERFORM public.assert_catalog_company_access(p_catalog_company_id);
  v_month_start := make_date(p_year, p_month, 1);
  v_hub_id := dunasoft.style_sync_hub_company_id();

  RETURN (
    SELECT count(*)::bigint
    FROM public.customers c
    LEFT JOIN legacy.clientes lc
      ON public.legacy_codcli_to_bigint(lc.codcli) = public.legacy_codcli_to_bigint(c.legacy_codcli)
    WHERE c.company_id = p_catalog_company_id
      AND (
        (
          public.legacy_text_to_date(lc.fecalta) IS NOT NULL
          AND date_trunc('month', public.legacy_text_to_date(lc.fecalta))::date = v_month_start
        )
        OR (
          public.legacy_text_to_date(lc.fecalta) IS NULL
          AND c.created_at >= v_month_start::timestamptz
          AND c.created_at < (v_month_start + interval '1 month')::timestamptz
          AND EXISTS (
            SELECT 1
            FROM dunasoft.style_sync_entity_map m
            WHERE m.suite_id = c.id
              AND m.entity_type = 'customer'
              AND m.company_id IN (p_catalog_company_id, v_hub_id)
              AND m.created_at >= v_month_start::timestamptz
              AND m.created_at < (v_month_start + interval '1 month')::timestamptz
          )
        )
      )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.count_style_new_customers_this_month(p_catalog_company_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.count_style_new_customers_for_month(
    p_catalog_company_id,
    extract(year FROM current_date)::int,
    extract(month FROM current_date)::int
  );
$$;

CREATE OR REPLACE FUNCTION public.dashboard_bonos_sold_by_employee(
  p_company_id uuid,
  p_year int,
  p_month int
)
RETURNS TABLE (
  employee_name text,
  sold_count bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, legacy
AS $$
DECLARE
  v_from date := make_date(p_year, p_month, 1);
  v_to date := (make_date(p_year, p_month, 1) + interval '1 month - 1 day')::date;
BEGIN
  RETURN QUERY
  WITH sold AS (
    SELECT
      b.id,
      nullif(btrim(lb.codemp), '') AS codemp
    FROM public.bonos b
    LEFT JOIN legacy.bonoscli lb
      ON public.legacy_codcli_to_bigint(lb.codboncli) = public.legacy_codcli_to_bigint(b.legacy_codboncli)
    WHERE b.company_id = p_company_id
      AND b.fecha_compra >= v_from
      AND b.fecha_compra <= v_to
    UNION ALL
    SELECT
      cv.id,
      NULL::text AS codemp
    FROM public.customer_vouchers cv
    WHERE cv.company_id = p_company_id
      AND cv.purchase_date >= v_from
      AND cv.purchase_date <= v_to
  )
  SELECT
    coalesce(
      ae.name,
      CASE WHEN s.codemp IS NOT NULL AND s.codemp <> '' THEN 'Empleada ' || s.codemp ELSE 'Sin asignar' END
    ) AS employee_name,
    count(*)::bigint AS sold_count
  FROM sold s
  LEFT JOIN public.agenda_employees ae
    ON ae.company_id = p_company_id
   AND coalesce(nullif(ltrim(btrim(coalesce(ae.dunasoft_codemp, '')), '0'), ''), '0')
     = coalesce(nullif(ltrim(btrim(coalesce(s.codemp, '')), '0'), ''), '0')
  GROUP BY 1
  ORDER BY sold_count DESC, employee_name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_style_new_customers_for_month(uuid, int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.dashboard_bonos_sold_by_employee(uuid, int, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.count_style_new_customers_for_month(uuid, int, int) IS
  'Clientes dados de alta en un mes/año concretos según fecalta Style (no fecha de importación).';

COMMENT ON FUNCTION public.dashboard_bonos_sold_by_employee(uuid, int, int) IS
  'Bonos y vouchers vendidos en un mes, agrupados por empleada (legacy.bonoscli.codemp).';
