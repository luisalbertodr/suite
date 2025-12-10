
-- Verificar y eliminar cualquier constraint único en la columna number de delivery_notes
DO $$ 
BEGIN
    -- Intentar eliminar el constraint único simple si existe
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'delivery_notes' 
        AND constraint_name = 'delivery_notes_number_key'
        AND constraint_type = 'UNIQUE'
    ) THEN
        ALTER TABLE public.delivery_notes DROP CONSTRAINT delivery_notes_number_key;
    END IF;
    
    -- Verificar que existe el constraint compuesto correcto
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'delivery_notes' 
        AND constraint_name = 'delivery_notes_number_company_unique'
        AND constraint_type = 'UNIQUE'
    ) THEN
        -- Crear el constraint único compuesto si no existe
        ALTER TABLE public.delivery_notes ADD CONSTRAINT delivery_notes_number_company_unique UNIQUE (number, company_id);
    END IF;
END $$;

-- Verificar que la función de generación de números funciona correctamente
-- y que maneja correctamente el filtro por empresa
CREATE OR REPLACE FUNCTION public.generate_delivery_note_number(company_id uuid, prefix text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  -- Lock the table to prevent race conditions
  LOCK TABLE public.delivery_notes IN EXCLUSIVE MODE;
  
  -- Get the highest number for this company and prefix
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(number FROM (prefix || '-(\d+)$')) AS INTEGER
      )
    ), 0
  ) + 1
  INTO next_number
  FROM public.delivery_notes
  WHERE delivery_notes.company_id = generate_delivery_note_number.company_id
    AND number ~ ('^' || prefix || '-\d+$');
  
  -- Format the new number
  new_number := prefix || '-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_number;
END;
$function$
