-- Add new fields for proper Verifactu chain management
ALTER TABLE public.verifactu_company_config 
ADD COLUMN IF NOT EXISTS ultimo_numero_registro_anterior bigint DEFAULT 0,
ADD COLUMN IF NOT EXISTS fecha_hora_ultimo_registro timestamp with time zone;

-- Add index for better performance on hash chain queries
CREATE INDEX IF NOT EXISTS idx_invoices_verifactu_chain 
ON public.invoices (company_id, verifactu_fecha_hora_huella) 
WHERE verifactu_status = 'accepted';

-- Function to get the last accepted invoice hash for a company
CREATE OR REPLACE FUNCTION public.get_last_verifactu_hash(p_company_id uuid)
RETURNS TABLE(
  hash_anterior text,
  numero_registro_anterior bigint,
  fecha_hora_anterior timestamp with time zone,
  es_primer_registro boolean
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Get the most recent successfully sent invoice for this company
  RETURN QUERY
  SELECT 
    i.verifactu_huella,
    COALESCE(i.verifactu_numero_registro::bigint, 0),
    i.verifactu_fecha_hora_huella,
    false as es_primer_registro
  FROM public.invoices i
  WHERE i.company_id = p_company_id
    AND i.verifactu_status = 'accepted'
    AND i.verifactu_huella IS NOT NULL
    AND i.verifactu_fecha_hora_huella IS NOT NULL
  ORDER BY i.verifactu_fecha_hora_huella DESC
  LIMIT 1;
  
  -- If no previous invoice found, this is the first register
  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 
      NULL::text as hash_anterior,
      0::bigint as numero_registro_anterior, 
      NULL::timestamp with time zone as fecha_hora_anterior,
      true as es_primer_registro;
  END IF;
END;
$$;

-- Function to update company's last hash after successful Verifactu submission
CREATE OR REPLACE FUNCTION public.update_company_last_verifactu_hash(
  p_company_id uuid,
  p_hash text,
  p_numero_registro bigint,
  p_fecha_hora timestamp with time zone
) 
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.verifactu_company_config
  SET 
    hash_anterior = p_hash,
    ultimo_numero_registro_anterior = p_numero_registro,
    fecha_hora_ultimo_registro = p_fecha_hora,
    updated_at = now()
  WHERE company_id = p_company_id;
END;
$$;