-- Código cliente Dunasoft (legacy_codcli) correlativo al máximo legacy + Suite.
-- El id UUID sigue siendo la clave primaria; legacy_codcli es secundario para cruce con legacy.

CREATE OR REPLACE FUNCTION public.legacy_codcli_to_bigint(p_code text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_code IS NULL OR btrim(p_code) = '' THEN NULL::bigint
    WHEN btrim(p_code) ~ '^\d+$' THEN NULLIF(ltrim(btrim(p_code), '0'), '')::bigint
    ELSE NULL::bigint
  END;
$$;

COMMENT ON FUNCTION public.legacy_codcli_to_bigint(text) IS
  'Valor numérico de un codcli Dunasoft (ignora ceros a la izquierda).';

CREATE OR REPLACE FUNCTION public.format_legacy_codcli(p_number bigint, p_width int DEFAULT 6)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_number IS NULL OR p_number < 0 THEN NULL
    ELSE lpad(p_number::text, GREATEST(p_width, length(p_number::text)), '0')
  END;
$$;

CREATE OR REPLACE FUNCTION public.generate_legacy_codcli(p_company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max bigint := 0;
  v_next bigint;
  v_width int := 6;
  v_code text;
  v_attempt int := 0;
  v_legacy_max bigint;
BEGIN
  IF p_company_id IS NULL THEN
    RAISE EXCEPTION 'company_id requerido para generate_legacy_codcli';
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    IF v_attempt > 20 THEN
      RAISE EXCEPTION 'No se pudo asignar legacy_codcli único para company %', p_company_id;
    END IF;

    LOCK TABLE public.customers IN EXCLUSIVE MODE;

    SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(c.legacy_codcli)), 0)
    INTO v_max
    FROM public.customers c
    WHERE c.company_id = p_company_id;

    IF to_regclass('legacy.clientes') IS NOT NULL THEN
      EXECUTE $sql$
        SELECT COALESCE(MAX(public.legacy_codcli_to_bigint(btrim(codcli::text))), 0)
        FROM legacy.clientes
        WHERE codcli IS NOT NULL AND btrim(codcli::text) <> ''
      $sql$
      INTO v_legacy_max;
      v_max := GREATEST(v_max, COALESCE(v_legacy_max, 0));
    END IF;

    v_next := v_max + 1;

    SELECT COALESCE(MAX(length(btrim(legacy_codcli))), 6)
    INTO v_width
    FROM public.customers
    WHERE company_id = p_company_id
      AND legacy_codcli IS NOT NULL
      AND btrim(legacy_codcli) ~ '^\d+$'
      AND public.legacy_codcli_to_bigint(legacy_codcli) = v_max;

    IF v_width IS NULL OR v_width < 6 THEN
      v_width := 6;
    END IF;

    v_code := public.format_legacy_codcli(v_next, v_width);

    IF NOT EXISTS (
      SELECT 1
      FROM public.customers c
      WHERE c.company_id = p_company_id
        AND c.legacy_codcli IS NOT NULL
        AND btrim(c.legacy_codcli) <> ''
        AND (
          btrim(c.legacy_codcli) = btrim(v_code)
          OR public.legacy_codcli_to_bigint(c.legacy_codcli) = v_next
        )
    ) THEN
      RETURN v_code;
    END IF;

    v_max := v_next;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.generate_legacy_codcli(uuid) IS
  'Siguiente codcli Dunasoft (6+ dígitos con ceros) tras el máximo en customers de la empresa y legacy.clientes.';

CREATE OR REPLACE FUNCTION public.customers_assign_legacy_codcli()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.legacy_codcli IS NULL OR btrim(NEW.legacy_codcli) = '' THEN
    NEW.legacy_codcli := public.generate_legacy_codcli(NEW.company_id);
  ELSE
    NEW.legacy_codcli := btrim(NEW.legacy_codcli);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS customers_assign_legacy_codcli ON public.customers;

CREATE TRIGGER customers_assign_legacy_codcli
  BEFORE INSERT ON public.customers
  FOR EACH ROW
  EXECUTE FUNCTION public.customers_assign_legacy_codcli();

COMMENT ON TRIGGER customers_assign_legacy_codcli ON public.customers IS
  'Asigna legacy_codcli correlativo si el alta no trae código (id UUID sigue siendo la clave).';
