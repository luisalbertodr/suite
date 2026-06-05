SELECT COUNT(*) AS non_legacy_children
FROM invoices child
WHERE child.original_invoice_id IN (
  SELECT i.id
  FROM invoices i
  WHERE i.company_id IN (
      '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
    )
    AND i.issue_date < DATE '2026-06-04'
    AND (
      i.number LIKE 'LEG-%'
      OR COALESCE(i.notes, '') ILIKE '%legacy%'
      OR COALESCE(i.notes, '') ILIKE '%Legacy FACCAB%'
      OR COALESCE(i.notes, '') ILIKE '%Factura legacy%'
      OR i.number ~ '^FAC-[0-9]'
    )
)
AND NOT (
  child.number LIKE 'LEG-%'
  OR COALESCE(child.notes, '') ILIKE '%legacy%'
  OR COALESCE(child.notes, '') ILIKE '%Legacy FACCAB%'
  OR COALESCE(child.notes, '') ILIKE '%Factura legacy%'
  OR child.number ~ '^FAC-[0-9]'
);
