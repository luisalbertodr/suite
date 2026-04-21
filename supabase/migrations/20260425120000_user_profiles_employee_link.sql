-- Vínculo opcional 1:1 entre usuario autenticado y empleado de agenda.
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS employee_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'user_profiles'
      AND constraint_name = 'user_profiles_employee_id_fkey'
  ) THEN
    ALTER TABLE public.user_profiles
      ADD CONSTRAINT user_profiles_employee_id_fkey
      FOREIGN KEY (employee_id)
      REFERENCES public.agenda_employees(id)
      ON DELETE SET NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_company_employee_unique
  ON public.user_profiles(company_id, employee_id)
  WHERE employee_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_profiles_company_user_unique
  ON public.user_profiles(company_id, user_id);
