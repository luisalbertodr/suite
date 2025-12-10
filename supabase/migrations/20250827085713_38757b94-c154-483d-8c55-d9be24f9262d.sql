-- Fix security warning: Add SET search_path to the set_accepted_date function
CREATE OR REPLACE FUNCTION public.set_accepted_date()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- If status is changing to 'aceptado' and accepted_date is null
  IF NEW.status = 'aceptado' AND OLD.status != 'aceptado' AND NEW.accepted_date IS NULL THEN
    NEW.accepted_date = now();
  END IF;
  RETURN NEW;
END;
$$;