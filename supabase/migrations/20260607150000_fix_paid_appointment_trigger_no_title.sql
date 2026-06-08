-- El trigger de citas cobradas referenciaba NEW.title, columna que no existe en agenda_appointments.

CREATE OR REPLACE FUNCTION public.prevent_paid_appointment_restricted_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.appointment_has_completed_sale(OLD.id) THEN
    IF
      NEW.employee_id IS DISTINCT FROM OLD.employee_id OR
      NEW.customer_id IS DISTINCT FROM OLD.customer_id OR
      NEW.client_name IS DISTINCT FROM OLD.client_name OR
      NEW.description IS DISTINCT FROM OLD.description OR
      NEW.start_time IS DISTINCT FROM OLD.start_time OR
      NEW.end_time IS DISTINCT FROM OLD.end_time OR
      NEW.appointment_date IS DISTINCT FROM OLD.appointment_date
    THEN
      RAISE EXCEPTION 'No se pueden modificar fecha, hora, cliente, empleada ni componentes de una cita cobrada.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
