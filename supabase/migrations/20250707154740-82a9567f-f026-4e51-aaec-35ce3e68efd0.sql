
-- Mejorar la función de generación de códigos de planilla para evitar duplicados
CREATE OR REPLACE FUNCTION public.generate_planilla_code(company_id uuid)
RETURNS text AS $$
DECLARE
  next_number INTEGER;
  new_code TEXT;
  max_attempts INTEGER := 5;
  attempt INTEGER := 0;
BEGIN
  LOOP
    -- Lock the table to prevent race conditions
    LOCK TABLE public.planillas IN EXCLUSIVE MODE;
    
    -- Get the highest number for this company
    SELECT COALESCE(
      MAX(
        CAST(
          SUBSTRING(codigo FROM 'PL-(\d+)$') AS INTEGER
        )
      ), 0
    ) + 1
    INTO next_number
    FROM public.planillas
    WHERE planillas.company_id = generate_planilla_code.company_id
      AND codigo ~ '^PL-\d+$';
    
    -- Format the new code
    new_code := 'PL-' || LPAD(next_number::TEXT, 6, '0');
    
    -- Check if this code already exists for this company
    IF NOT EXISTS (
      SELECT 1 FROM public.planillas 
      WHERE codigo = new_code 
      AND planillas.company_id = generate_planilla_code.company_id
    ) THEN
      RETURN new_code;
    END IF;
    
    -- If we reach here, there was a conflict, try again
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      -- As a last resort, add timestamp to ensure uniqueness
      new_code := 'PL-' || LPAD(next_number::TEXT, 6, '0') || '-' || EXTRACT(EPOCH FROM NOW())::INTEGER;
      RETURN new_code;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
