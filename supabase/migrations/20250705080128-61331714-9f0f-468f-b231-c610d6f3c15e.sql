
-- Eliminar la función actual que no considera company_id
DROP FUNCTION IF EXISTS generate_ticket_number();

-- Crear nueva función que considera company_id
CREATE OR REPLACE FUNCTION generate_ticket_number(company_uuid uuid)
RETURNS TEXT AS $$
DECLARE
  next_number INTEGER;
  ticket_num TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  LOOP
    -- Bloquear la tabla para prevenir condiciones de carrera
    LOCK TABLE public.sales IN EXCLUSIVE MODE;
    
    -- Obtener el siguiente número de ticket para esta empresa específica
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 'TPV-(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.sales
    WHERE ticket_number ~ '^TPV-\d+$' 
    AND company_id = company_uuid;
    
    -- Formatear el número de ticket
    ticket_num := 'TPV-' || LPAD(next_number::TEXT, 6, '0');
    
    -- Verificar si ya existe este número para esta empresa
    IF NOT EXISTS (SELECT 1 FROM public.sales WHERE ticket_number = ticket_num AND company_id = company_uuid) THEN
      RETURN ticket_num;
    END IF;
    
    -- Si llegamos aquí, hubo un conflicto, intentar de nuevo
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      -- Como último recurso, usar timestamp para garantizar unicidad
      ticket_num := 'TPV-' || LPAD(next_number::TEXT, 6, '0') || '-' || EXTRACT(EPOCH FROM NOW())::INTEGER;
      RETURN ticket_num;
    END IF;
    
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Actualizar el trigger para pasar el company_id a la función
CREATE OR REPLACE FUNCTION set_ticket_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := generate_ticket_number(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Modificar el constraint único para incluir company_id
ALTER TABLE public.sales DROP CONSTRAINT IF EXISTS sales_ticket_number_key;
ALTER TABLE public.sales ADD CONSTRAINT sales_ticket_number_company_unique UNIQUE (ticket_number, company_id);
