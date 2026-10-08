-- Fix style_resolve_existing_customer: min(uuid) is invalid in Postgres.

CREATE OR REPLACE FUNCTION dunasoft.style_resolve_existing_customer(p_company_id uuid, p_codcli text, p_name text, p_tel1 text, p_tel2 text, p_dni text)
 RETURNS uuid
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'dunasoft', 'public'
AS $$
DECLARE
  v_codcli text := btrim(coalesce(p_codcli, ''));
  v_name text := lower(btrim(coalesce(p_name, '')));
  v_dni text := upper(regexp_replace(btrim(coalesce(p_dni, '')), '[\s\-\.]', '', 'g'));
  v_phone_norm text;
  v_id uuid;
  v_n int;
BEGIN
  IF v_codcli = '' OR v_codcli = '0' THEN
    RETURN NULL;
  END IF;

  v_id := dunasoft.style_map_suite_id(p_company_id, 'customer', v_codcli);
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT c.id INTO v_id
  FROM public.customers c
  WHERE c.company_id = p_company_id
    AND public.legacy_codcli_to_bigint(c.legacy_codcli)
        = public.legacy_codcli_to_bigint(v_codcli)
  ORDER BY (c.archived_at IS NULL) DESC, c.updated_at DESC NULLS LAST
  LIMIT 1;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  v_phone_norm := public.customer_primary_phone_last9(p_tel2, p_tel1, NULL);
  IF v_phone_norm IS NULL THEN
    v_phone_norm := public.customer_primary_phone_last9(p_tel1, p_tel2, NULL);
  END IF;
  IF v_phone_norm IS NOT NULL THEN
    SELECT count(*), (array_agg(c.id ORDER BY c.id))[1] INTO v_n, v_id
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.archived_at IS NULL
      AND c.phone_norm = v_phone_norm;
    IF v_n = 1 THEN
      RETURN v_id;
    END IF;
  END IF;

  IF v_dni <> '' AND length(v_dni) >= 5 THEN
    SELECT count(*), (array_agg(c.id ORDER BY c.id))[1] INTO v_n, v_id
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.archived_at IS NULL
      AND upper(regexp_replace(btrim(coalesce(c.tax_id, '')), '[\s\-\.]', '', 'g')) = v_dni;
    IF v_n = 1 THEN
      RETURN v_id;
    END IF;
  END IF;

  IF v_name <> '' AND v_name NOT LIKE 'cliente %' AND length(v_name) >= 8 THEN
    SELECT count(*), (array_agg(c.id ORDER BY c.id))[1] INTO v_n, v_id
    FROM public.customers c
    WHERE c.company_id = p_company_id
      AND c.archived_at IS NULL
      AND lower(btrim(c.name)) = v_name;
    IF v_n = 1 THEN
      RETURN v_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;


