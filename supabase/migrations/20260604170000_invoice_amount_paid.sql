-- Cobro parcial en facturas. Backfill: scripts/backfill_invoice_amount_paid.py
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.invoices.amount_paid IS
  'Importe ya cobrado. Pendiente = total_amount - amount_paid.';
