-- Sync marketing Presentada: evitar timeout al filtrar ventas facturadas por cliente.
CREATE INDEX IF NOT EXISTS idx_sales_company_customer_billed
  ON public.sales (company_id, customer_id)
  WHERE status = 'completed'
    AND appointment_id IS NOT NULL
    AND invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_company_appointment_billed
  ON public.sales (company_id, appointment_id)
  WHERE status = 'completed'
    AND appointment_id IS NOT NULL
    AND invoice_id IS NOT NULL
    AND customer_id IS NULL;
