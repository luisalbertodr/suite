-- Búsqueda de clientes más rápida: pg_trgm + proyección de columnas ligeras + prefiltro indexable.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Índice para LIKE '%term%' sobre nombre normalizado (activos).
CREATE INDEX IF NOT EXISTS customers_active_name_trgm_idx
  ON public.customers
  USING gin (public.customer_search_normalize(name) gin_trgm_ops)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS customers_archived_name_trgm_idx
  ON public.customers
  USING gin (public.customer_search_normalize(name) gin_trgm_ops)
  WHERE archived_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS customers_company_active_idx
  ON public.customers (company_id)
  WHERE archived_at IS NULL;

DROP FUNCTION IF EXISTS public.search_customers(uuid, text, int);

CREATE OR REPLACE FUNCTION public.search_customers(
  p_catalog_company_id uuid,
  p_query text,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  tax_id text,
  phone text,
  phone_home text,
  phone_mobile text,
  legacy_codcli text,
  address_city text,
  photo_url text,
  archived_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terms text[];
  v_limit int;
  v_first text;
BEGIN
  v_terms := public.customer_search_terms(p_query);
  IF p_catalog_company_id IS NULL OR cardinality(v_terms) = 0 THEN
    RETURN;
  END IF;

  PERFORM public.assert_catalog_company_access(p_catalog_company_id);
  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 100), 200));
  v_first := v_terms[1];

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.email,
    c.tax_id,
    c.phone,
    c.phone_home,
    c.phone_mobile,
    c.legacy_codcli,
    c.address_city,
    c.photo_url,
    c.archived_at
  FROM public.customers c
  WHERE c.company_id = p_catalog_company_id
    AND c.archived_at IS NULL
    AND (
      public.customer_search_normalize(c.name) LIKE '%' || v_first || '%'
      OR public.customer_search_normalize(coalesce(c.email, '')) LIKE '%' || v_first || '%'
      OR lower(replace(coalesce(c.tax_id, ''), ' ', '')) LIKE '%' || v_first || '%'
      OR public.customer_search_normalize(coalesce(c.legacy_codcli, '')) LIKE '%' || v_first || '%'
      OR (
        v_first ~ '^\d+$'
        AND regexp_replace(
          concat_ws('', c.phone, c.phone_mobile, c.phone_home, c.tax_id, c.legacy_codcli),
          '\D',
          '',
          'g'
        ) LIKE '%' || v_first || '%'
      )
    )
    AND public.customer_matches_search_terms(
      c.name,
      c.email,
      c.tax_id,
      c.phone,
      c.phone_mobile,
      c.phone_home,
      coalesce(c.legacy_codcli, ''),
      v_terms
    )
  ORDER BY c.name
  LIMIT v_limit;
END;
$$;

DROP FUNCTION IF EXISTS public.search_archived_customers(uuid, text, int);

CREATE OR REPLACE FUNCTION public.search_archived_customers(
  p_catalog_company_id uuid,
  p_query text DEFAULT NULL,
  p_limit int DEFAULT 100
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  tax_id text,
  phone text,
  phone_home text,
  phone_mobile text,
  legacy_codcli text,
  address_city text,
  photo_url text,
  archived_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terms text[];
  v_limit int;
  v_first text;
BEGIN
  IF p_catalog_company_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.assert_catalog_company_access(p_catalog_company_id);
  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 100), 200));
  v_terms := public.customer_search_terms(coalesce(p_query, ''));
  v_first := CASE WHEN cardinality(v_terms) > 0 THEN v_terms[1] ELSE NULL END;

  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.email,
    c.tax_id,
    c.phone,
    c.phone_home,
    c.phone_mobile,
    c.legacy_codcli,
    c.address_city,
    c.photo_url,
    c.archived_at
  FROM public.customers c
  WHERE c.company_id = p_catalog_company_id
    AND c.archived_at IS NOT NULL
    AND (
      v_first IS NULL
      OR public.customer_search_normalize(c.name) LIKE '%' || v_first || '%'
      OR public.customer_search_normalize(coalesce(c.email, '')) LIKE '%' || v_first || '%'
      OR lower(replace(coalesce(c.tax_id, ''), ' ', '')) LIKE '%' || v_first || '%'
      OR public.customer_search_normalize(coalesce(c.legacy_codcli, '')) LIKE '%' || v_first || '%'
      OR (
        v_first ~ '^\d+$'
        AND regexp_replace(
          concat_ws('', c.phone, c.phone_mobile, c.phone_home, c.tax_id, c.legacy_codcli),
          '\D',
          '',
          'g'
        ) LIKE '%' || v_first || '%'
      )
    )
    AND (
      v_first IS NULL
      OR public.customer_matches_search_terms(
        c.name,
        c.email,
        c.tax_id,
        c.phone,
        c.phone_mobile,
        c.phone_home,
        coalesce(c.legacy_codcli, ''),
        v_terms
      )
    )
  ORDER BY c.archived_at DESC NULLS LAST, c.name
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_customers(uuid, text, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_archived_customers(uuid, text, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.search_customers(uuid, text, int) IS
  'Búsqueda de clientes activos (columnas ligeras + prefiltro trgm).';
