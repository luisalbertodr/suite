
-- Crear una función thread-safe para generar números de ticket
CREATE OR REPLACE FUNCTION generate_ticket_number()
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
    
    -- Obtener el siguiente número de ticket
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 'TPV-(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.sales
    WHERE ticket_number ~ '^TPV-\d+$';
    
    -- Formatear el número de ticket
    ticket_num := 'TPV-' || LPAD(next_number::TEXT, 6, '0');
    
    -- Verificar si ya existe este número
    IF NOT EXISTS (SELECT 1 FROM public.sales WHERE ticket_number = ticket_num) THEN
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
