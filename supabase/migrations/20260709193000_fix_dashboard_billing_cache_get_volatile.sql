-- dashboard_billing_cache_get hace UPDATE (LRU): debe ser VOLATILE, no STABLE.

CREATE OR REPLACE FUNCTION public.dashboard_billing_cache_get(p_cache_key text)
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid := public.get_user_company_id();
  v_payload jsonb;
BEGIN
  IF p_cache_key IS NULL OR btrim(p_cache_key) = '' OR v_company_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.dashboard_billing_query_cache c
  SET last_accessed_at = now()
  WHERE c.cache_key = p_cache_key
    AND c.company_id = v_company_id
  RETURNING c.payload INTO v_payload;

  RETURN v_payload;
END;
$$;

COMMENT ON FUNCTION public.dashboard_billing_cache_get(text) IS
  'Lee caché de facturación dashboard y actualiza last_accessed_at (LRU). VOLATILE por el UPDATE.';
