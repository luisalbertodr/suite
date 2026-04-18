-- Ítems de cita (servicios/productos/bonos) con duración y flag "ocupa tiempo"
CREATE TABLE public.appointment_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  appointment_id UUID NOT NULL REFERENCES public.agenda_appointments(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'service' CHECK (kind IN ('service', 'product', 'bonus', 'other')),
  label TEXT NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  occupies_time BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  article_id UUID REFERENCES public.articles(id) ON DELETE SET NULL,
  customer_voucher_id UUID REFERENCES public.customer_vouchers(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX appointment_items_appointment_id_idx ON public.appointment_items(appointment_id);

ALTER TABLE public.appointment_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage appointment items"
ON public.appointment_items FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.agenda_appointments a
  WHERE a.id = appointment_items.appointment_id
  AND a.company_id = get_user_company_id()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.agenda_appointments a
  WHERE a.id = appointment_items.appointment_id
  AND a.company_id = get_user_company_id()
));

CREATE POLICY "Users can view appointment items"
ON public.appointment_items FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.agenda_appointments a
  WHERE a.id = appointment_items.appointment_id
  AND a.company_id = get_user_company_id()
));

CREATE TRIGGER update_appointment_items_updated_at
  BEFORE UPDATE ON public.appointment_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
