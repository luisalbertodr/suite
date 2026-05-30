-- Numeración TPV: contador atómico por empresa (evita LOCK TABLE sales + SCAN masivo).

CREATE TABLE IF NOT EXISTS public.sales_ticket_counters (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  counter_key text NOT NULL,
  last_number integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, counter_key)
);

COMMENT ON TABLE public.sales_ticket_counters IS
  'Contador atómico por empresa/clave para numeración TPV (TPV o PREFIJO-AÑO).';

-- Semilla: tickets TPV-NNNNNN (ignora LEG-* y prefijados).
INSERT INTO public.sales_ticket_counters (company_id, counter_key, last_number)
SELECT
  s.company_id,
  'TPV',
  COALESCE(MAX(CAST(SUBSTRING(s.ticket_number FROM '^TPV-(\d+)$') AS INTEGER)), 0)
FROM public.sales s
WHERE s.company_id IS NOT NULL
  AND s.ticket_number ~ '^TPV-\d+$'
GROUP BY s.company_id
ON CONFLICT (company_id, counter_key) DO UPDATE
SET last_number = GREATEST(public.sales_ticket_counters.last_number, EXCLUDED.last_number);

-- Semilla: tickets PREFIJO-AÑO-NNNNNN (p. ej. M-2026-000001).
INSERT INTO public.sales_ticket_counters (company_id, counter_key, last_number)
SELECT
  s.company_id,
  regexp_replace(s.ticket_number, '-\d+$', '') AS counter_key,
  MAX(CAST(SUBSTRING(s.ticket_number FROM '(\d+)$') AS INTEGER)) AS last_number
FROM public.sales s
WHERE s.company_id IS NOT NULL
  AND s.ticket_number ~ '^[^-]+-\d{4}-\d{6}$'
GROUP BY s.company_id, regexp_replace(s.ticket_number, '-\d+$', '')
ON CONFLICT (company_id, counter_key) DO UPDATE
SET last_number = GREATEST(public.sales_ticket_counters.last_number, EXCLUDED.last_number);

CREATE OR REPLACE FUNCTION public.generate_ticket_number(company_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  prefix TEXT;
  year_part TEXT;
  v_counter_key TEXT;
  next_number INTEGER;
  ticket_num TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(tpv_ticket_prefix), ''), NULL)
  INTO prefix
  FROM public.companies
  WHERE id = company_uuid;

  year_part := EXTRACT(YEAR FROM NOW())::TEXT;

  IF prefix IS NOT NULL THEN
    v_counter_key := prefix || '-' || year_part;
    INSERT INTO public.sales_ticket_counters (company_id, counter_key, last_number)
    VALUES (company_uuid, v_counter_key, 1)
    ON CONFLICT (company_id, counter_key)
    DO UPDATE SET
      last_number = public.sales_ticket_counters.last_number + 1,
      updated_at = now()
    RETURNING last_number INTO next_number;

    ticket_num := v_counter_key || '-' || LPAD(next_number::TEXT, 6, '0');
  ELSE
    v_counter_key := 'TPV';
    INSERT INTO public.sales_ticket_counters (company_id, counter_key, last_number)
    VALUES (company_uuid, v_counter_key, 1)
    ON CONFLICT (company_id, counter_key)
    DO UPDATE SET
      last_number = public.sales_ticket_counters.last_number + 1,
      updated_at = now()
    RETURNING last_number INTO next_number;

    ticket_num := 'TPV-' || LPAD(next_number::TEXT, 6, '0');
  END IF;

  RETURN ticket_num;
END;
$$;
