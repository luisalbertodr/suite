-- InBody: no crear ficha "Paciente InBody"; vincular mediciones huérfanas al completar tax_id.

CREATE OR REPLACE FUNCTION public.normalize_inbody_dni_key(p_value text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT nullif(
    upper(regexp_replace(btrim(coalesce(p_value, '')), '[^A-Z0-9]', '', 'g')),
    ''
  );
$$;

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

  keys := array_append(keys, v);

  IF v ~ '^\d{7,8}[A-Z]?$' THEN
    v_num := lpad(regexp_replace(v, '[A-Z]$', ''), 8, '0');
    keys := array_append(keys, v_num);
    v_stripped := regexp_replace(v_num, '^0+', '');
    IF v_stripped = '' THEN v_stripped := '0'; END IF;
    keys := array_append(keys, v_stripped);
    keys := array_append(keys, lpad(v_stripped, 8, '0'));
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
  v_company_id uuid;
  v_tax_id text;
  v_keys text[];
  v_updated integer := 0;
BEGIN
  IF p_customer_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT company_id, tax_id
    INTO v_company_id, v_tax_id
  FROM public.customers
  WHERE id = p_customer_id;

  IF v_company_id IS NULL THEN
    RETURN 0;
  END IF;

  v_keys := public.inbody_dni_match_keys(v_tax_id);
  IF v_keys IS NULL OR coalesce(array_length(v_keys, 1), 0) = 0 THEN
    RETURN 0;
  END IF;

  UPDATE public.inbody_measurements im
  SET customer_id = p_customer_id,
      updated_at = now()
  WHERE im.company_id = v_company_id
    AND (
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

CREATE OR REPLACE FUNCTION public.trg_customers_link_inbody_on_tax_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.tax_id IS NULL OR btrim(NEW.tax_id) = '' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
     AND public.normalize_inbody_dni_key(OLD.tax_id)
         IS NOT DISTINCT FROM public.normalize_inbody_dni_key(NEW.tax_id) THEN
    RETURN NEW;
  END IF;

  PERFORM public.link_inbody_measurements_by_customer_dni(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_link_inbody_on_tax_id ON public.customers;
CREATE TRIGGER customers_link_inbody_on_tax_id
  AFTER INSERT OR UPDATE OF tax_id ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_customers_link_inbody_on_tax_id();

COMMENT ON FUNCTION public.link_inbody_measurements_by_customer_dni(uuid) IS
  'Vincula mediciones InBody huérfanas (o de placeholders) al cliente cuando coincide el DNI.';

GRANT EXECUTE ON FUNCTION public.link_inbody_measurements_by_customer_dni(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_inbody_measurements_by_customer_dni(uuid) TO service_role;

-- One-shot: re-vincular huérfanas a fichas reales existentes por DNI
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.id
    FROM public.customers c
    WHERE nullif(btrim(c.tax_id), '') IS NOT NULL
      AND NOT public.is_inbody_placeholder_customer_name(c.name)
  LOOP
    PERFORM public.link_inbody_measurements_by_customer_dni(r.id);
  END LOOP;
END;
$$;
