-- Búsqueda de clientes por palabras independientes:
-- "luis diaz" debe encontrar "Luis Alberto Díaz".

CREATE OR REPLACE FUNCTION public.customer_search_normalize(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(
    translate(
      lower(coalesce(p_value, '')),
      'áàäâãåéèëêíìïîóòöôõúùüûñç',
      'aaaaaaeeeeiiiiooooouuuunc'
    ),
    '\s+',
    ' ',
    'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.customer_search_terms(p_query text)
RETURNS text[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(t), ARRAY[]::text[])
  FROM regexp_split_to_table(public.customer_search_normalize(trim(coalesce(p_query, ''))), '\s+') AS t
  WHERE length(t) > 0;
$$;

CREATE OR REPLACE FUNCTION public.customer_matches_search_terms(
  p_name text,
  p_email text,
  p_tax_id text,
  p_phone text,
  p_phone_mobile text,
  p_phone_home text,
  p_legacy_codcli text,
  p_terms text[]
)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  WITH haystack AS (
    SELECT
      public.customer_search_normalize(
        concat_ws(
          ' ',
          p_name,
          p_email,
          p_tax_id,
          p_phone,
          p_phone_mobile,
          p_phone_home,
          p_legacy_codcli
        )
      ) AS text_value,
      regexp_replace(
        concat_ws('', p_phone, p_phone_mobile, p_phone_home, p_tax_id, p_legacy_codcli),
        '\D',
        '',
        'g'
      ) AS digit_value
  )
  SELECT NOT EXISTS (
    SELECT 1
    FROM unnest(COALESCE(p_terms, ARRAY[]::text[])) AS term
    CROSS JOIN haystack h
    WHERE NOT (
      h.text_value LIKE '%' || term || '%'
      OR (term ~ '^\d+$' AND h.digit_value LIKE '%' || term || '%')
    )
  );
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

GRANT EXECUTE ON FUNCTION public.customer_search_normalize(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_search_terms(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.customer_matches_search_terms(text, text, text, text, text, text, text, text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_customer_ids(uuid, text, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_customers(uuid, text, int) TO authenticated, service_role;
