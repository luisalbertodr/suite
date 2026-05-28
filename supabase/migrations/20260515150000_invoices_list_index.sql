-- Índice para listado paginado de facturas por empresa (Facturas.tsx)
CREATE INDEX IF NOT EXISTS idx_invoices_company_created_at
  ON public.invoices (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_number_trgm
  ON public.invoices (company_id, number varchar_pattern_ops);
