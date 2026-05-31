-- Búsqueda de clientes vía RPC (evita 500 de PostgREST/RLS en filtros ilike sobre customers).

CREATE OR REPLACE FUNCTION public.customer_search_pattern(p_query text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '%' || replace(
    replace(
      replace(trim(coalesce(p_query, '')), '\', '\\'),
      '%', '\%'
    ),
    '_', '\_'
  ) || '%';
$$;

CREATE OR REPLACE FUNCTION public.search_customer_ids(
  p_catalog_company_id uuid,
  p_query text,
  p_limit int DEFAULT 100
)
RETURNS SETOF uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pattern text;
  v_limit int;
BEGIN
  IF p_catalog_company_id IS NULL OR length(trim(coalesce(p_query, ''))) < 2 THEN
    RETURN;
  END IF;

  IF NOT (
    p_catalog_company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(p_catalog_company_id)
  ) THEN
    RAISE EXCEPTION 'No autorizado para buscar clientes de esta empresa'
      USING ERRCODE = '42501';
  END IF;

  v_pattern := public.customer_search_pattern(p_query);
  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 100), 200));

  RETURN QUERY
  SELECT c.id
  FROM public.customers c
  WHERE c.company_id = p_catalog_company_id
    AND (
      c.name ILIKE v_pattern ESCAPE '\'
      OR c.email ILIKE v_pattern ESCAPE '\'
      OR c.tax_id ILIKE v_pattern ESCAPE '\'
      OR c.phone ILIKE v_pattern ESCAPE '\'
      OR c.phone_mobile ILIKE v_pattern ESCAPE '\'
      OR c.phone_home ILIKE v_pattern ESCAPE '\'
      OR coalesce(c.legacy_codcli, '') ILIKE v_pattern ESCAPE '\'
    )
  ORDER BY c.name
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_customers(
  p_catalog_company_id uuid,
  p_query text,
  p_limit int DEFAULT 100
)
RETURNS SETOF public.customers
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pattern text;
  v_limit int;
BEGIN
  IF p_catalog_company_id IS NULL OR length(trim(coalesce(p_query, ''))) < 2 THEN
    RETURN;
  END IF;

  IF NOT (
    p_catalog_company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(p_catalog_company_id)
  ) THEN
    RAISE EXCEPTION 'No autorizado para buscar clientes de esta empresa'
      USING ERRCODE = '42501';
  END IF;

  v_pattern := public.customer_search_pattern(p_query);
  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 100), 200));

  RETURN QUERY
  SELECT c.*
  FROM public.customers c
  WHERE c.company_id = p_catalog_company_id
    AND (
      c.name ILIKE v_pattern ESCAPE '\'
      OR c.email ILIKE v_pattern ESCAPE '\'
      OR c.tax_id ILIKE v_pattern ESCAPE '\'
      OR c.phone ILIKE v_pattern ESCAPE '\'
      OR c.phone_mobile ILIKE v_pattern ESCAPE '\'
      OR c.phone_home ILIKE v_pattern ESCAPE '\'
      OR coalesce(c.legacy_codcli, '') ILIKE v_pattern ESCAPE '\'
    )
  ORDER BY c.name
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.customer_search_pattern(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_customer_ids(uuid, text, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_customers(uuid, text, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.search_customer_ids(uuid, text, int) IS
  'IDs de clientes del catálogo por texto (nombre, email, NIF, teléfonos). SECURITY DEFINER con control de acceso del centro laboral.';

COMMENT ON FUNCTION public.search_customers(uuid, text, int) IS
  'Clientes del catálogo por texto. Misma lógica que search_customer_ids pero devuelve filas completas.';
