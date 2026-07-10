-- Clientes nuevos del mes según fecha de alta en Style (fecalta), no por importación masiva.

CREATE OR REPLACE FUNCTION public.legacy_text_to_date(p_text text)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_text IS NULL OR btrim(p_text) = '' THEN NULL::date
    WHEN length(btrim(p_text)) = 8 AND btrim(p_text) ~ '^\d{8}$' THEN
      to_date(btrim(p_text), 'YYYYMMDD')
    WHEN btrim(p_text) ~ '^\d{4}-\d{2}-\d{2}' THEN (left(btrim(p_text), 10))::date
    ELSE NULL::date
  END;
$$;

CREATE OR REPLACE FUNCTION public.count_style_new_customers_this_month(p_catalog_company_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, legacy, dunasoft
AS $$
DECLARE
  v_month_start date := date_trunc('month', current_date)::date;
  v_hub_id uuid;
BEGIN
  PERFORM public.assert_catalog_company_access(p_catalog_company_id);
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
          AND EXISTS (
            SELECT 1
            FROM dunasoft.style_sync_entity_map m
            WHERE m.suite_id = c.id
              AND m.entity_type = 'customer'
              AND m.company_id IN (p_catalog_company_id, v_hub_id)
              AND m.created_at >= v_month_start::timestamptz
          )
        )
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.legacy_text_to_date(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.count_style_new_customers_this_month(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.count_style_new_customers_this_month(uuid) IS
  'Clientes dados de alta este mes en Style (fecalta legacy o sync reciente sin fecalta importada).';
