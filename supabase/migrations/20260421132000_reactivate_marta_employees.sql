DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agenda_employees'
      AND column_name = 'is_active'
  ) THEN
    EXECUTE 'UPDATE public.agenda_employees SET is_active = TRUE WHERE name ILIKE ''Marta%''';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'agenda_employees'
      AND column_name = 'active'
  ) THEN
    EXECUTE 'UPDATE public.agenda_employees SET active = TRUE WHERE name ILIKE ''Marta%''';
  END IF;
END $$;
