-- appointment_items: alinear RLS con agenda_appointments (get_user_accessible_company_ids).
-- Tras 20260531233000 las citas usan empresas accesibles del centro; los ítems seguían con
-- get_user_company_id() + company_in_user_work_center(), lo que podía devolver 0 filas vía API
-- aunque la cita fuera visible (importe 0 € y «Cobrar en TPV» deshabilitado).

DROP POLICY IF EXISTS "Users can view appointment items" ON public.appointment_items;
DROP POLICY IF EXISTS "Users can manage appointment items" ON public.appointment_items;

CREATE POLICY "Users can view appointment items"
  ON public.appointment_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.agenda_appointments a
      WHERE a.id = appointment_items.appointment_id
        AND a.company_id IN (SELECT public.get_user_accessible_company_ids())
    )
  );

CREATE POLICY "Users can manage appointment items"
  ON public.appointment_items FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.agenda_appointments a
      WHERE a.id = appointment_items.appointment_id
        AND a.company_id IN (SELECT public.get_user_accessible_company_ids())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.agenda_appointments a
      WHERE a.id = appointment_items.appointment_id
        AND a.company_id IN (SELECT public.get_user_accessible_company_ids())
    )
  );
