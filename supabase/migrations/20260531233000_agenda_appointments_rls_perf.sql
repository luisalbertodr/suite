-- agenda_appointments: evitar timeout 500 en listados (77k+ filas).
-- La política anterior llamaba company_in_user_work_center(company_id) por fila
-- (~9 ms × N filas). Usamos el set de empresas accesibles (evaluado una vez).
-- Índice (company_id, created_at DESC) para ORDER BY + LIMIT del dashboard.

DROP POLICY IF EXISTS "Users can view their company's appointments" ON public.agenda_appointments;
DROP POLICY IF EXISTS "Users can insert appointments for their company" ON public.agenda_appointments;
DROP POLICY IF EXISTS "Users can update their company's appointments" ON public.agenda_appointments;
DROP POLICY IF EXISTS "Users can delete their company's appointments" ON public.agenda_appointments;

CREATE POLICY "Users can view their company's appointments"
  ON public.agenda_appointments FOR SELECT TO authenticated
  USING (
    company_id IN (SELECT public.get_user_accessible_company_ids())
  );

CREATE POLICY "Users can insert appointments for their company"
  ON public.agenda_appointments FOR INSERT TO authenticated
  WITH CHECK (
    company_id IN (SELECT public.get_user_accessible_company_ids())
  );

CREATE POLICY "Users can update their company's appointments"
  ON public.agenda_appointments FOR UPDATE TO authenticated
  USING (
    company_id IN (SELECT public.get_user_accessible_company_ids())
  )
  WITH CHECK (
    company_id IN (SELECT public.get_user_accessible_company_ids())
  );

CREATE POLICY "Users can delete their company's appointments"
  ON public.agenda_appointments FOR DELETE TO authenticated
  USING (
    company_id IN (SELECT public.get_user_accessible_company_ids())
  );

CREATE INDEX IF NOT EXISTS idx_agenda_appointments_company_created_at
  ON public.agenda_appointments (company_id, created_at DESC);

-- Misma optimización en empleados de agenda (mismo patrón RLS).
DROP POLICY IF EXISTS "Users can access their company's agenda employees" ON public.agenda_employees;

CREATE POLICY "Users can access their company's agenda employees"
  ON public.agenda_employees FOR ALL TO authenticated
  USING (
    company_id IN (SELECT public.get_user_accessible_company_ids())
  )
  WITH CHECK (
    company_id IN (SELECT public.get_user_accessible_company_ids())
  );
