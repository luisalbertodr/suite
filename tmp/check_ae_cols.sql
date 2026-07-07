SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'agenda_employees'
  AND column_name IN ('dunasoft_codemp', 'is_active', 'active');
