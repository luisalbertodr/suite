-- Lectura de clientes del catálogo: RLS simplificado + RPC (PostgREST devolvía 500 en /customers).

-- ---------------------------------------------------------------------------
-- 1. RLS customers: una sola comprobación (incluye hermanos del centro laboral)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view customers in their company" ON public.customers;
DROP POLICY IF EXISTS "Users can insert customers in their company" ON public.customers;
DROP POLICY IF EXISTS "Users can update customers in their company" ON public.customers;
DROP POLICY IF EXISTS "Users can delete customers in their company" ON public.customers;

CREATE POLICY "Users can view customers in their company"
  ON public.customers FOR SELECT TO authenticated
  USING (public.user_can_access_company(company_id));

CREATE POLICY "Users can insert customers in their company"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_company(company_id));

CREATE POLICY "Users can update customers in their company"
  ON public.customers FOR UPDATE TO authenticated
  USING (public.user_can_access_company(company_id))
  WITH CHECK (public.user_can_access_company(company_id));

CREATE POLICY "Users can delete customers in their company"
  ON public.customers FOR DELETE TO authenticated
  USING (public.user_can_access_company(company_id));

-- ---------------------------------------------------------------------------
-- 2. RPC listado / conteo (SECURITY DEFINER, fallback estable vía PostgREST)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.assert_catalog_company_access(p_catalog_company_id uuid)
RETURNS void
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_catalog_company_id IS NULL OR NOT public.user_can_access_company(p_catalog_company_id) THEN
    RAISE EXCEPTION 'No autorizado para acceder a clientes de esta empresa'
      USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_catalog_customers(
  p_catalog_company_id uuid,
  p_limit int DEFAULT 5000,
  p_offset int DEFAULT 0
)
RETURNS SETOF public.customers
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int;
  v_offset int;
BEGIN
  PERFORM public.assert_catalog_company_access(p_catalog_company_id);
  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 5000), 10000));
  v_offset := GREATEST(0, coalesce(p_offset, 0));

  RETURN QUERY
  SELECT c.*
  FROM public.customers c
  WHERE c.company_id = p_catalog_company_id
  ORDER BY c.name
  LIMIT v_limit
  OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_catalog_customers(p_catalog_company_id uuid)
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_catalog_company_access(p_catalog_company_id);

  RETURN (
    SELECT count(*)::bigint
    FROM public.customers c
    WHERE c.company_id = p_catalog_company_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.recent_catalog_customers(
  p_catalog_company_id uuid,
  p_limit int DEFAULT 10
)
RETURNS TABLE (name text, created_at timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit int;
BEGIN
  PERFORM public.assert_catalog_company_access(p_catalog_company_id);
  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 10), 50));

  RETURN QUERY
  SELECT c.name, c.created_at
  FROM public.customers c
  WHERE c.company_id = p_catalog_company_id
  ORDER BY c.created_at DESC
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.assert_catalog_company_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_catalog_customers(uuid, int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.count_catalog_customers(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recent_catalog_customers(uuid, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.list_catalog_customers(uuid, int, int) IS
  'Listado de clientes del catálogo compartido (centro laboral). Evita 500 de PostgREST en SELECT directo.';

COMMENT ON FUNCTION public.count_catalog_customers(uuid) IS
  'Conteo de clientes del catálogo compartido.';

-- Alinear RPC de búsqueda con la misma comprobación de acceso
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
  PERFORM public.assert_catalog_company_access(p_catalog_company_id);
  v_pattern := public.customer_search_pattern(p_query);
  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 100), 200));
  RETURN QUERY
  SELECT c.id FROM public.customers c
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
  ORDER BY c.name LIMIT v_limit;
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
  PERFORM public.assert_catalog_company_access(p_catalog_company_id);
  v_pattern := public.customer_search_pattern(p_query);
  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 100), 200));
  RETURN QUERY
  SELECT c.* FROM public.customers c
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
  ORDER BY c.name LIMIT v_limit;
END;
$$;
