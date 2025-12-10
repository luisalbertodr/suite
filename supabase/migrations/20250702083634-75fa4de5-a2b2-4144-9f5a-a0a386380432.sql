
-- Verificar el estado actual de la tabla y forzar el cambio de tipo
DO $$
BEGIN
    -- Primero eliminar cualquier constraint que pueda existir
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'agenda_appointments_employee_id_fkey' 
        AND table_name = 'agenda_appointments'
    ) THEN
        ALTER TABLE public.agenda_appointments DROP CONSTRAINT agenda_appointments_employee_id_fkey;
    END IF;
    
    -- Verificar el tipo actual de la columna
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'agenda_appointments' 
        AND column_name = 'employee_id' 
        AND data_type = 'uuid'
    ) THEN
        -- Si es UUID, cambiar a TEXT
        ALTER TABLE public.agenda_appointments ALTER COLUMN employee_id TYPE TEXT USING employee_id::TEXT;
    END IF;
END $$;

-- Limpiar cualquier dato existente que pueda causar conflictos
DELETE FROM public.agenda_appointments;
