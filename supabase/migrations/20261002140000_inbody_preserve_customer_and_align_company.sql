-- InBody: no pisar customer_id en reimport; al vincular, alinear company_id a la ficha si no hay conflicto.

-- 1) Preservar customer_id si un upsert/reimport manda NULL
CREATE OR REPLACE FUNCTION public.trg_inbody_preserve_customer_id()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.customer_id IS NULL AND OLD.customer_id IS NOT NULL THEN
    NEW.customer_id := OLD.customer_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS inbody_preserve_customer_id ON public.inbody_measurements;
CREATE TRIGGER inbody_preserve_customer_id
  BEFORE UPDATE ON public.inbody_measurements
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_inbody_preserve_customer_id();

COMMENT ON FUNCTION public.trg_inbody_preserve_customer_id() IS
  'Evita que un reimport LookInBody con customer_id NULL desvincule una ficha ya enlazada.';

-- 2) Link por DNI + mover a company del cliente cuando no hay colisión de unique
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
    AND public.normalize_inbody_dni_key(im.inbody_user_id) = ANY (v_keys);

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

COMMENT ON FUNCTION public.link_inbody_measurements_by_customer_dni(uuid) IS
  'Vincula InBody por DNI cross-company y, si no hay conflicto unique, mueve company_id a la de la ficha.';

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

-- Re-vincular y alinear company (incl. filas ya enlazadas a otra company)
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
  RAISE NOTICE 'link_inbody_measurements_by_customer_dni total touched rows (sum): %', n;
END;
$$;
