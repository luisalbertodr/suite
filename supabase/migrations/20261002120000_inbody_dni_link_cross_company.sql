-- InBody: vincular mediciones huérfanas por DNI sin filtrar por company_id.
-- Los clientes se comparten entre empresas (Style / Medicina); el match es solo por DNI.

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
  v_keys text[];
  v_updated integer := 0;
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT tax_id
    INTO v_tax_id
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
  SET customer_id = p_customer_id,
      updated_at = now()
  WHERE (
      im.customer_id IS NULL
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
    AND public.normalize_inbody_dni_key(im.inbody_user_id) = ANY (v_keys);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.link_inbody_measurements_by_customer_dni(uuid) IS
  'Vincula mediciones InBody huérfanas (o de placeholders) al cliente por DNI, sin filtrar por company_id (clientes compartidos).';

-- Reasigna todas las huérfanas matchables a la mejor ficha por DNI
-- (prioriza misma company, luego ficha más antigua no-placeholder).
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
     AND public.normalize_inbody_dni_key(im.inbody_user_id)
           = ANY (public.inbody_dni_match_keys(c.tax_id))
    WHERE im.customer_id IS NULL
       OR EXISTS (
         SELECT 1
         FROM public.customers ph
         WHERE ph.id = im.customer_id
           AND public.is_inbody_placeholder_customer_name(ph.name)
       )
  ),
  picked AS (
    SELECT measurement_id, customer_id
    FROM candidates
    WHERE rn = 1
  ),
  upd AS (
    UPDATE public.inbody_measurements im
    SET customer_id = p.customer_id,
        updated_at = now()
    FROM picked p
    WHERE im.id = p.measurement_id
      AND im.customer_id IS DISTINCT FROM p.customer_id
    RETURNING im.id
  )
  SELECT count(*)::integer INTO v_updated FROM upd;

  RETURN coalesce(v_updated, 0);
END;
$$;

COMMENT ON FUNCTION public.link_all_orphan_inbody_measurements_by_dni() IS
  'One-shot / mantenimiento: reasigna InBody huérfanos (o placeholders) a fichas reales por DNI cross-company.';

GRANT EXECUTE ON FUNCTION public.link_all_orphan_inbody_measurements_by_dni() TO service_role;

-- Backfill inmediato
SELECT public.link_all_orphan_inbody_measurements_by_dni();
