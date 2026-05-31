-- Agenda compartida del centro laboral (tenant operativo compartido).
-- Permite leer/gestionar empleados y citas del catálogo aunque la empresa
-- activa sea otra del mismo work_center (p. ej. Medicina vs Estética).

-- ---------------------------------------------------------------------------
-- agenda_employees
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view agenda employees in their company" ON public.agenda_employees;
DROP POLICY IF EXISTS "Users can manage agenda employees in their company" ON public.agenda_employees;
DROP POLICY IF EXISTS "Users can access their company's agenda employees" ON public.agenda_employees;

CREATE POLICY "Users can access their company's agenda employees"
  ON public.agenda_employees FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

-- ---------------------------------------------------------------------------
-- agenda_appointments
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view appointments in their company" ON public.agenda_appointments;
DROP POLICY IF EXISTS "Users can manage appointments in their company" ON public.agenda_appointments;
DROP POLICY IF EXISTS "Users can access their company's appointments" ON public.agenda_appointments;
DROP POLICY IF EXISTS "Users can access their company's agenda appointments" ON public.agenda_appointments;
DROP POLICY IF EXISTS "Users can view their company's appointments" ON public.agenda_appointments;
DROP POLICY IF EXISTS "Users can insert appointments for their company" ON public.agenda_appointments;
DROP POLICY IF EXISTS "Users can update their company's appointments" ON public.agenda_appointments;
DROP POLICY IF EXISTS "Users can delete their company's appointments" ON public.agenda_appointments;

CREATE POLICY "Users can view their company's appointments"
  ON public.agenda_appointments FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can insert appointments for their company"
  ON public.agenda_appointments FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can update their company's appointments"
  ON public.agenda_appointments FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can delete their company's appointments"
  ON public.agenda_appointments FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

-- ---------------------------------------------------------------------------
-- cabinas / recursos
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage cabinas in their company" ON public.cabinas;
DROP POLICY IF EXISTS "Users can view cabinas in their company" ON public.cabinas;

CREATE POLICY "Users can view cabinas in their company"
  ON public.cabinas FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can manage cabinas in their company"
  ON public.cabinas FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

DROP POLICY IF EXISTS "Users can manage recursos in their company" ON public.recursos;
DROP POLICY IF EXISTS "Users can view recursos in their company" ON public.recursos;

CREATE POLICY "Users can view recursos in their company"
  ON public.recursos FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can manage recursos in their company"
  ON public.recursos FOR ALL TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  )
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

-- ---------------------------------------------------------------------------
-- appointment_items / appointment_resources
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage appointment items" ON public.appointment_items;
DROP POLICY IF EXISTS "Users can view appointment items" ON public.appointment_items;

CREATE POLICY "Users can view appointment items"
  ON public.appointment_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.agenda_appointments a
      WHERE a.id = appointment_items.appointment_id
        AND (
          a.company_id = public.get_user_company_id()
          OR public.company_in_user_work_center(a.company_id)
        )
    )
  );

CREATE POLICY "Users can manage appointment items"
  ON public.appointment_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.agenda_appointments a
      WHERE a.id = appointment_items.appointment_id
        AND (
          a.company_id = public.get_user_company_id()
          OR public.company_in_user_work_center(a.company_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.agenda_appointments a
      WHERE a.id = appointment_items.appointment_id
        AND (
          a.company_id = public.get_user_company_id()
          OR public.company_in_user_work_center(a.company_id)
        )
    )
  );

DROP POLICY IF EXISTS "Users can manage appointment resources" ON public.appointment_resources;
DROP POLICY IF EXISTS "Users can view appointment resources" ON public.appointment_resources;

CREATE POLICY "Users can view appointment resources"
  ON public.appointment_resources FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.agenda_appointments a
      WHERE a.id = appointment_resources.appointment_id
        AND (
          a.company_id = public.get_user_company_id()
          OR public.company_in_user_work_center(a.company_id)
        )
    )
  );

CREATE POLICY "Users can manage appointment resources"
  ON public.appointment_resources FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.agenda_appointments a
      WHERE a.id = appointment_resources.appointment_id
        AND (
          a.company_id = public.get_user_company_id()
          OR public.company_in_user_work_center(a.company_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.agenda_appointments a
      WHERE a.id = appointment_resources.appointment_id
        AND (
          a.company_id = public.get_user_company_id()
          OR public.company_in_user_work_center(a.company_id)
        )
    )
  );
