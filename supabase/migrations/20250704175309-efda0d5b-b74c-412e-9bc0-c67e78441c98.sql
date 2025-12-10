
-- Verificar y eliminar cualquier constraint único en la columna number de delivery_notes
ALTER TABLE public.delivery_notes DROP CONSTRAINT IF EXISTS delivery_notes_number_key;

-- Crear un constraint único compuesto que permita el mismo número para diferentes empresas
ALTER TABLE public.delivery_notes ADD CONSTRAINT delivery_notes_number_company_unique UNIQUE (number, company_id);

-- Crear función para generar números de albarán por empresa (similar a las facturas)
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
