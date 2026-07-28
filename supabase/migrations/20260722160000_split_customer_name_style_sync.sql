-- Repara nombres/encoding clientes Suite + Dunasoft y corrige push Suite→Style.
-- Regla de split: últimas 2 palabras = apellidos; resto = nombre.
-- 2 palabras → nombre + apellido; 1 palabra → solo nombre.

CREATE OR REPLACE FUNCTION public.repair_customer_text(p_value text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text := btrim(coalesce(p_value, ''));
BEGIN
  IF t = '' THEN
    RETURN t;
  END IF;

  -- Mojibake UTF-8 leído como Latin-1
  t := replace(t, U&'\00C3\00A1', 'á'); -- Ã¡
  t := replace(t, U&'\00C3\00A9', 'é');
  t := replace(t, U&'\00C3\00AD', 'í');
  t := replace(t, U&'\00C3\00B3', 'ó');
  t := replace(t, U&'\00C3\00BA', 'ú');
  t := replace(t, U&'\00C3\00B1', 'ñ');
  t := replace(t, U&'\00C3\0081', 'Á'); -- Ã + 0x81
  t := replace(t, U&'\00C3\0089', 'É');
  t := replace(t, U&'\00C3\008D', 'Í');
  t := replace(t, U&'\00C3\0093', 'Ó');
  t := replace(t, U&'\00C3\009A', 'Ú');
  t := replace(t, U&'\00C3\0091', 'Ñ');
  t := replace(t, U&'\00C3\00BC', 'ü');
  t := replace(t, U&'\00C2\00BF', '¿');
  t := replace(t, U&'\00C2\00A1', '¡');

  -- Corrupciones vistas en Style/Suite (Ñ → C1 / C / Q)
  t := regexp_replace(t, '(?i)espa\s*c1\s*a', 'España', 'g');
  t := regexp_replace(t, '(?i)\bcoruqa\b', 'CORUÑA', 'g');
  t := regexp_replace(t, '(?i)\bcoruca\b', 'CORUÑA', 'g');
  t := regexp_replace(t, '(?i)\bracas\b', 'RAÑAS', 'g');

  RETURN btrim(t);
END;
$$;

COMMENT ON FUNCTION public.repair_customer_text(text) IS
  'Repara mojibake y sustituciones típicas de Ñ (EspaC1a, CORUQA, RACAS).';

CREATE OR REPLACE FUNCTION public.split_customer_display_name(p_full text)
RETURNS TABLE(nomcli text, ape1cli text)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  cleaned text;
  parts text[];
  n int;
BEGIN
  cleaned := public.repair_customer_text(p_full);
  cleaned := btrim(regexp_replace(cleaned, '\s+', ' ', 'g'));
  IF cleaned = '' THEN
    nomcli := NULL;
    ape1cli := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  -- Razones sociales: no separar
  IF cleaned ~* '\y(s\.?\s*l\.?u?\.?|s\.?\s*a\.?|s\.?\s*c\.?|s\.?\s*coop|cb|slu|sl|sa)\y'
     OR cleaned ~* '\y(sociedad|cooperativa|fundaci[oó]n|asociaci[oó]n)\y' THEN
    nomcli := cleaned;
    ape1cli := NULL;
    RETURN NEXT;
    RETURN;
  END IF;

  parts := regexp_split_to_array(cleaned, ' ');
  n := coalesce(array_length(parts, 1), 0);

  IF n <= 1 THEN
    nomcli := cleaned;
    ape1cli := NULL;
  ELSIF n = 2 THEN
    nomcli := parts[1];
    ape1cli := parts[2];
  ELSE
    nomcli := array_to_string(parts[1:n-2], ' ');
    ape1cli := array_to_string(parts[n-1:n], ' ');
  END IF;

  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION public.split_customer_display_name(text) IS
  'Separa nombre completo: últimas 2 palabras = apellidos; resto = nombre de pila.';

CREATE OR REPLACE FUNCTION public.customers_enqueue_style_sync()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
DECLARE
  v_op text;
  v_split record;
  v_full_name text;
BEGIN
  IF current_setting('dunasoft.in_style_apply', true) = '1' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF NOT dunasoft.suite_to_style_enabled('clientes') THEN
    RETURN NEW;
  END IF;

  v_op := CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END;
  v_full_name := public.repair_customer_text(NEW.name);
  SELECT * INTO v_split FROM public.split_customer_display_name(v_full_name);

  PERFORM dunasoft.enqueue_style_entity(
    NEW.company_id, 'customer', v_op, NEW.legacy_codcli, NEW.id,
    jsonb_build_object(
      'codcli', NEW.legacy_codcli,
      'nomcli', coalesce(v_split.nomcli, ''),
      'ape1cli', coalesce(v_split.ape1cli, ''),
      'tel1cli', coalesce(NEW.phone_home, NEW.phone, ''),
      'tel2cli', coalesce(NEW.phone_mobile, ''),
      'email', coalesce(NEW.email, ''),
      'dnicli', coalesce(NEW.tax_id, ''),
      'dircli', coalesce(public.repair_customer_text(NEW.address_street), ''),
      'codposcli', coalesce(NEW.address_postal_code, ''),
      'pobcli', coalesce(public.repair_customer_text(NEW.address_city), ''),
      'procli', coalesce(public.repair_customer_text(NEW.address_state), ''),
      'pais', coalesce(public.repair_customer_text(NEW.address_country), ''),
      'percon', coalesce(public.repair_customer_text(NEW.contact_person), ''),
      'obscli', coalesce(public.repair_customer_text(NEW.notes), ''),
      'fecnac', coalesce(to_char(NEW.birth_date, 'YYYY-MM-DD'), '')
    )
  );
  RETURN NEW;
END;
$$;
