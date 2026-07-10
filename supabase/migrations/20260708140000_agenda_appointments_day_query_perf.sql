-- Acelera la carga diaria de agenda (filtro company_id + rango start_time).
CREATE INDEX IF NOT EXISTS idx_agenda_appointments_company_start_time
  ON public.agenda_appointments (company_id, start_time);

CREATE INDEX IF NOT EXISTS idx_agenda_appointments_company_appointment_date
  ON public.agenda_appointments (company_id, appointment_date)
  WHERE appointment_date IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointment_items_appointment_id
  ON public.appointment_items (appointment_id);

CREATE INDEX IF NOT EXISTS idx_sales_appointment_id_not_cancelled
  ON public.sales (appointment_id)
  WHERE appointment_id IS NOT NULL AND status IS DISTINCT FROM 'cancelled';
