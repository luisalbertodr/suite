-- Soft-delete de clientes: archivar en lugar de borrar.
-- Evita pérdida accidental y respeta FKs de facturación.

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

COMMENT ON COLUMN public.customers.archived_at IS
  'Si no es NULL, el cliente está archivado (no aparece en búsquedas/catálogo activos).';

CREATE INDEX IF NOT EXISTS customers_company_archived_at_idx
  ON public.customers (company_id, archived_at);

-- Unicidad de teléfono solo entre clientes activos (archivados no bloquean reutilización).
DROP INDEX IF EXISTS public.customers_company_phone_norm_uidx;

CREATE UNIQUE INDEX customers_company_phone_norm_uidx
  ON public.customers (company_id, phone_norm)
  WHERE phone_norm IS NOT NULL AND archived_at IS NULL;

-- Catálogo / búsqueda: excluir archivados por defecto.
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
    AND c.archived_at IS NULL
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
      AND c.archived_at IS NULL
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
    AND c.archived_at IS NULL
  ORDER BY c.created_at DESC
  LIMIT v_limit;
END;
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
  v_terms text[];
  v_limit int;
BEGIN
  v_terms := public.customer_search_terms(p_query);
  IF p_catalog_company_id IS NULL OR cardinality(v_terms) = 0 THEN
    RETURN;
  END IF;

  PERFORM public.assert_catalog_company_access(p_catalog_company_id);
  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 100), 200));

  RETURN QUERY
  SELECT c.id
  FROM public.customers c
  WHERE c.company_id = p_catalog_company_id
    AND c.archived_at IS NULL
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
  v_terms text[];
  v_limit int;
BEGIN
  v_terms := public.customer_search_terms(p_query);
  IF p_catalog_company_id IS NULL OR cardinality(v_terms) = 0 THEN
    RETURN;
  END IF;

  PERFORM public.assert_catalog_company_access(p_catalog_company_id);
  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 100), 200));

  RETURN QUERY
  SELECT c.*
  FROM public.customers c
  WHERE c.company_id = p_catalog_company_id
    AND c.archived_at IS NULL
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

-- Búsqueda / listado de archivados para restaurar.
CREATE OR REPLACE FUNCTION public.search_archived_customers(
  p_catalog_company_id uuid,
  p_query text DEFAULT NULL,
  p_limit int DEFAULT 100
)
RETURNS SETOF public.customers
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_terms text[];
  v_limit int;
BEGIN
  IF p_catalog_company_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM public.assert_catalog_company_access(p_catalog_company_id);
  v_limit := GREATEST(1, LEAST(coalesce(p_limit, 100), 200));
  v_terms := public.customer_search_terms(coalesce(p_query, ''));

  RETURN QUERY
  SELECT c.*
  FROM public.customers c
  WHERE c.company_id = p_catalog_company_id
    AND c.archived_at IS NOT NULL
    AND (
      cardinality(v_terms) = 0
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
  ORDER BY c.archived_at DESC, c.name
  LIMIT v_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_archived_customers(uuid, text, int) TO authenticated, service_role;

COMMENT ON FUNCTION public.search_archived_customers(uuid, text, int) IS
  'Clientes archivados del catálogo (archived_at IS NOT NULL). Query opcional; vacío lista los más recientes.';
