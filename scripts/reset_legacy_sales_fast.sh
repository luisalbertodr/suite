#!/bin/bash
set -e
docker exec supabase-db psql -U postgres -d postgres <<'SQL'
\set ON_ERROR_STOP on
BEGIN;
-- Ventas LEG primero (más selectivo)
DELETE FROM public.sale_items si
USING public.sales s
WHERE si.sale_id = s.id
  AND s.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  AND s.ticket_number LIKE 'LEG-%';
DELETE FROM public.sales
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  AND ticket_number LIKE 'LEG-%';
-- Facturas legacy huérfanas
DELETE FROM public.invoice_items
WHERE invoice_id IN (
  SELECT id FROM public.invoices
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
    AND (notes LIKE 'Factura legacy automática%' OR notes LIKE 'Factura legacy sin cita%')
);
DELETE FROM public.invoices
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  AND (notes LIKE 'Factura legacy automática%' OR notes LIKE 'Factura legacy sin cita%');
COMMIT;
SELECT 'OK reset LEG sales' AS status;
SQL
