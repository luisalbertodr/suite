-- Purga facturación legacy duplicada (Estética + Medicina). No toca Verifactu sent/accepted.

BEGIN;

DO $$
DECLARE
  protected int;
BEGIN
  SELECT COUNT(*) INTO protected
  FROM public.invoices i
  WHERE i.company_id IN (
      '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
    )
    AND i.issue_date < DATE '2026-06-04'
    AND COALESCE(i.verifactu_status, '') IN ('sent', 'accepted')
    AND (
      i.number LIKE 'LEG-%'
      OR COALESCE(i.notes, '') ILIKE '%legacy%'
      OR COALESCE(i.notes, '') ILIKE '%Legacy FACCAB%'
      OR COALESCE(i.notes, '') ILIKE '%Factura legacy%'
      OR i.number ~ '^FAC-[0-9]'
    );
  IF protected > 0 THEN
    RAISE EXCEPTION 'Hay % facturas legacy con Verifactu enviado/aceptado', protected;
  END IF;
END $$;

DELETE FROM public.invoice_items ii
USING public.invoices i
WHERE ii.invoice_id = i.id
  AND i.company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND i.issue_date < DATE '2026-06-04'
  AND COALESCE(i.verifactu_status, '') NOT IN ('sent', 'accepted', 'rejected')
  AND (
    i.number LIKE 'LEG-%'
    OR COALESCE(i.notes, '') ILIKE '%legacy%'
    OR COALESCE(i.notes, '') ILIKE '%Legacy FACCAB%'
    OR COALESCE(i.notes, '') ILIKE '%Factura legacy%'
    OR i.number ~ '^FAC-[0-9]'
    OR EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.invoice_id = i.id
        AND (
          s.ticket_number LIKE 'LEG-%'
          OR s.ticket_number ~ '^FAC-[0-9]'
          OR COALESCE(s.notes, '') ILIKE '%legacy%'
        )
    )
  );

DELETE FROM public.invoices i
WHERE i.company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND i.issue_date < DATE '2026-06-04'
  AND COALESCE(i.verifactu_status, '') NOT IN ('sent', 'accepted', 'rejected')
  AND (
    i.number LIKE 'LEG-%'
    OR COALESCE(i.notes, '') ILIKE '%legacy%'
    OR COALESCE(i.notes, '') ILIKE '%Legacy FACCAB%'
    OR COALESCE(i.notes, '') ILIKE '%Factura legacy%'
    OR i.number ~ '^FAC-[0-9]'
    OR EXISTS (
      SELECT 1 FROM public.sales s
      WHERE s.invoice_id = i.id
        AND (
          s.ticket_number LIKE 'LEG-%'
          OR s.ticket_number ~ '^FAC-[0-9]'
          OR COALESCE(s.notes, '') ILIKE '%legacy%'
        )
    )
  );

DELETE FROM public.sale_items si
USING public.sales s
WHERE si.sale_id = s.id
  AND s.company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND (
    s.ticket_number LIKE 'LEG-%'
    OR s.ticket_number ~ '^FAC-[0-9]'
    OR COALESCE(s.notes, '') ILIKE '%legacy%'
  );

DELETE FROM public.sales s
WHERE s.company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
  AND (
    s.ticket_number LIKE 'LEG-%'
    OR s.ticket_number ~ '^FAC-[0-9]'
    OR COALESCE(s.notes, '') ILIKE '%legacy%'
  );

CREATE TEMP TABLE _dup_invoices ON COMMIT DROP AS
SELECT id
FROM (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY company_id, number
           ORDER BY created_at, id
         ) AS rn
  FROM public.invoices
  WHERE company_id IN (
      '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
    )
    AND issue_date < DATE '2026-06-04'
    AND number IS NOT NULL AND btrim(number) <> ''
    AND COALESCE(verifactu_status, '') NOT IN ('sent', 'accepted')
) t
WHERE rn > 1;

DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM _dup_invoices);
UPDATE public.sales SET invoice_id = NULL WHERE invoice_id IN (SELECT id FROM _dup_invoices);
DELETE FROM public.invoices WHERE id IN (SELECT id FROM _dup_invoices);

COMMIT;

SELECT COUNT(*) AS invoices_remaining FROM public.invoices;
