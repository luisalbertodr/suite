
-- Eliminar la restricción de unicidad global en el código de planillas
ALTER TABLE public.planillas DROP CONSTRAINT IF EXISTS planillas_codigo_key;

-- Agregar una restricción de unicidad compuesta que combine código y empresa
-- Esto permite que diferentes empresas tengan el mismo código de planilla
ALTER TABLE public.planillas ADD CONSTRAINT planillas_codigo_company_unique UNIQUE (codigo, company_id);

-- Simplificar la función de generación de códigos ya que ahora solo necesita ser única por empresa
CREATE OR REPLACE FUNCTION public.generate_planilla_code(company_id uuid)
RETURNS text AS $$
DECLARE
  next_number INTEGER;
  new_code TEXT;
BEGIN
  -- Obtener el siguiente número para esta empresa específica
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
  
  -- Formatear el nuevo código
  new_code := 'PL-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
