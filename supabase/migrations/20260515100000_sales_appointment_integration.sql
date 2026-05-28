-- Enlace estructural ventas TPV ↔ citas ↔ facturas
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS appointment_id uuid REFERENCES public.agenda_appointments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_appointment_id
  ON public.sales (appointment_id)
  WHERE appointment_id IS NOT NULL;

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.sales.appointment_id IS 'Cita de agenda que originó el cobro en TPV';
COMMENT ON COLUMN public.invoices.sale_id IS 'Ticket TPV facturado';
