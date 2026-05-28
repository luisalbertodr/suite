-- Enlace venta TPV → cliente (faltaba en prod tras esquema simplificado)
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_customer_id
  ON public.sales (customer_id)
  WHERE customer_id IS NOT NULL;

COMMENT ON COLUMN public.sales.customer_id IS 'Cliente asociado al ticket TPV';
