-- InBody / báscula:
-- 1) Normalizar DNI upper() ANTES de quitar no-alfanuméricos (fix: tax_id "32714482h" perdía la letra).
-- 2) Vincular por solape de claves (con y sin letra de control).
-- 3) Alinear company_id de mediciones ya vinculadas a la ficha (clientes compartidos).

CREATE OR REPLACE FUNCTION public.normalize_inbody_dni_key(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(
    regexp_replace(upper(btrim(coalesce(p_value, ''))), '[^A-Z0-9]', '', 'g'),
    ''
  );
$$;

COMMENT ON FUNCTION public.normalize_inbody_dni_key(text) IS
  'DNI/NIE InBody normalizado: upper primero, luego solo A-Z0-9 (con/sin letra equivalentes vía inbody_dni_match_keys).';

CREATE OR REPLACE FUNCTION public.inbody_dni_match_keys(p_value text)
RETURNS text[]
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v text := public.normalize_inbody_dni_key(p_value);
  v_num text;
  v_stripped text;
  keys text[] := ARRAY[]::text[];
BEGIN
  IF v IS NULL THEN
    RETURN keys;
  END IF;

  -- IDs de báscula / Morpho: no expandir como DNI
  IF v ~ '^(SCALE|MS:)' THEN
    RETURN ARRAY[v];
  END IF;

  keys := array_append(keys, v);

  IF v ~ '^\d{7,8}[A-Z]?$' THEN
    v_num := lpad(regexp_replace(v, '[A-Z]$', ''), 8, '0');
    keys := array_append(keys, v_num);
    v_stripped := regexp_replace(v_num, '^0+', '');
    IF v_stripped = '' THEN v_stripped := '0'; END IF;
    keys := array_append(keys, v_stripped);
    keys := array_append(keys, lpad(v_stripped, 8, '0'));
    -- Variante con letra de control si solo venían dígitos
    IF v ~ '^\d{7,8}$' THEN
      keys := array_append(
        keys,
        v_num || substr('TRWAGMYFPDXBNJZSQVHLCKE', ((v_num::bigint % 23)::integer + 1), 1)
      );
    END IF;
  ELSIF v ~ '^[XYZ]\d{7}[A-Z]?$' THEN
    v_num := regexp_replace(v, '[A-Z]$', '');
    keys := array_append(keys, v_num);
  ELSIF v ~ '^[A-Z0-9]+$' AND v ~ '[0-9]' AND right(v, 1) ~ '[A-Z]' THEN
    v_num := left(v, length(v) - 1);
    keys := array_append(keys, v_num);
    IF v_num ~ '^\d{7,8}$' THEN
      keys := array_append(keys, lpad(v_num, 8, '0'));
    END IF;
  END IF;

  RETURN (
    SELECT array_agg(DISTINCT k)
    FROM unnest(keys) AS k
    WHERE nullif(btrim(k), '') IS NOT NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.link_inbody_measurements_by_customer_dni(
  p_customer_id uuid
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tax_id text;
  v_company_id uuid;
  v_keys text[];
  v_updated integer := 0;
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT tax_id, company_id
    INTO v_tax_id, v_company_id
  FROM public.customers
  WHERE id = p_customer_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  v_keys := public.inbody_dni_match_keys(v_tax_id);
  IF v_keys IS NULL OR coalesce(array_length(v_keys, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.inbody_measurements im
  SET
    customer_id = p_customer_id,
    company_id = CASE
      WHEN im.company_id IS NOT DISTINCT FROM v_company_id THEN im.company_id
      WHEN EXISTS (
        SELECT 1
        FROM public.inbody_measurements other
        WHERE other.company_id = v_company_id
          AND other.inbody_user_id = im.inbody_user_id
          AND other.measured_at = im.measured_at
          AND other.id IS DISTINCT FROM im.id
      ) THEN im.company_id
      ELSE v_company_id
    END,
    updated_at = now()
  WHERE (
      im.customer_id IS NULL
      OR im.customer_id = p_customer_id
      OR (
        im.customer_id IS DISTINCT FROM p_customer_id
        AND EXISTS (
          SELECT 1
          FROM public.customers c
          WHERE c.id = im.customer_id
            AND public.is_inbody_placeholder_customer_name(c.name)
        )
      )
    )
    -- Con y sin letra: solape de claves (no solo normalize = ANY)
    AND public.inbody_dni_match_keys(im.inbody_user_id) && v_keys;

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.link_inbody_measurements_by_customer_dni(uuid) IS
  'Vincula InBody/báscula por DNI (con/sin letra, case-insensitive) cross-company y alinea company_id a la ficha si no hay conflicto unique.';

CREATE OR REPLACE FUNCTION public.link_all_orphan_inbody_measurements_by_dni()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated integer := 0;
BEGIN
  WITH candidates AS (
    SELECT
      im.id AS measurement_id,
      c.id AS customer_id,
      c.company_id AS customer_company_id,
      row_number() OVER (
        PARTITION BY im.id
        ORDER BY
          CASE WHEN c.company_id IS NOT DISTINCT FROM im.company_id THEN 0 ELSE 1 END,
          c.created_at ASC NULLS LAST,
          c.id ASC
      ) AS rn
    FROM public.inbody_measurements im
    JOIN public.customers c
      ON nullif(btrim(c.tax_id), '') IS NOT NULL
     AND NOT public.is_inbody_placeholder_customer_name(c.name)
     AND public.inbody_dni_match_keys(im.inbody_user_id)
           && public.inbody_dni_match_keys(c.tax_id)
    WHERE im.customer_id IS NULL
       OR EXISTS (
         SELECT 1
         FROM public.customers ph
         WHERE ph.id = im.customer_id
           AND public.is_inbody_placeholder_customer_name(ph.name)
       )
  ),
  picked AS (
    SELECT measurement_id, customer_id, customer_company_id
    FROM candidates
    WHERE rn = 1
  ),
  upd AS (
    UPDATE public.inbody_measurements im
    SET
      customer_id = p.customer_id,
      company_id = CASE
        WHEN im.company_id IS NOT DISTINCT FROM p.customer_company_id THEN im.company_id
        WHEN EXISTS (
          SELECT 1
          FROM public.inbody_measurements other
          WHERE other.company_id = p.customer_company_id
            AND other.inbody_user_id = im.inbody_user_id
            AND other.measured_at = im.measured_at
            AND other.id IS DISTINCT FROM im.id
        ) THEN im.company_id
        ELSE p.customer_company_id
      END,
      updated_at = now()
    FROM picked p
    WHERE im.id = p.measurement_id
      AND (
        im.customer_id IS DISTINCT FROM p.customer_id
        OR im.company_id IS DISTINCT FROM CASE
          WHEN im.company_id IS NOT DISTINCT FROM p.customer_company_id THEN im.company_id
          WHEN EXISTS (
            SELECT 1
            FROM public.inbody_measurements other
            WHERE other.company_id = p.customer_company_id
              AND other.inbody_user_id = im.inbody_user_id
              AND other.measured_at = im.measured_at
              AND other.id IS DISTINCT FROM im.id
          ) THEN im.company_id
          ELSE p.customer_company_id
        END
      )
    RETURNING im.id
  )
  SELECT count(*)::integer INTO v_updated FROM upd;

  RETURN coalesce(v_updated, 0);
END;
$$;

-- Alinear company de mediciones YA vinculadas (clientes compartidos / báscula)
WITH upd AS (
  UPDATE public.inbody_measurements im
  SET company_id = c.company_id,
      updated_at = now()
  FROM public.customers c
  WHERE c.id = im.customer_id
    AND im.company_id IS DISTINCT FROM c.company_id
    AND NOT public.is_inbody_placeholder_customer_name(c.name)
    AND NOT EXISTS (
      SELECT 1
      FROM public.inbody_measurements other
      WHERE other.company_id = c.company_id
        AND other.inbody_user_id = im.inbody_user_id
        AND other.measured_at = im.measured_at
        AND other.id IS DISTINCT FROM im.id
    )
  RETURNING im.id
)
SELECT count(*) AS aligned_company FROM upd;

-- Re-vincular huérfanas / alinear por DNI con la nueva normalización
DO $$
DECLARE
  r record;
  n integer := 0;
BEGIN
  FOR r IN
    SELECT c.id
    FROM public.customers c
    WHERE nullif(btrim(c.tax_id), '') IS NOT NULL
      AND NOT public.is_inbody_placeholder_customer_name(c.name)
  LOOP
    n := n + public.link_inbody_measurements_by_customer_dni(r.id);
  END LOOP;
  RAISE NOTICE 'link_inbody_measurements_by_customer_dni touched (sum): %', n;
END;
$$;
