-- Borra ventas/facturas legacy (tickets LEG-*) sin escanear toda la agenda.
-- Empresa Estética: 5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4

BEGIN;

DELETE FROM public.invoice_items ii
USING public.invoices i
WHERE ii.invoice_id = i.id
  AND i.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  AND (
    i.notes LIKE 'Factura legacy automática%'
    OR i.notes LIKE 'Factura legacy sin cita%'
    OR i.number LIKE 'LEG-%'
  );

DELETE FROM public.invoices i
WHERE i.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  AND NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.invoice_id = i.id)
  AND (
    i.notes LIKE 'Factura legacy automática%'
    OR i.notes LIKE 'Factura legacy sin cita%'
    OR i.number LIKE 'LEG-%'
  );

DELETE FROM public.sale_items si
USING public.sales s
WHERE si.sale_id = s.id
  AND s.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  AND s.ticket_number LIKE 'LEG-%';

DELETE FROM public.sales s
WHERE s.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  AND s.ticket_number LIKE 'LEG-%';

COMMIT;
