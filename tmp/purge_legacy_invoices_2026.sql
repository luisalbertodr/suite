-- Purga facturas legacy duplicadas ene-may 2026 (Estética + Medicina)

DO $purge$
DECLARE
  r record;
  n int;
BEGIN
  FOR r IN
    SELECT to_char(d, 'YYYY-MM') AS ym,
           d::date AS start_d,
           (d + interval '1 month')::date AS end_d
    FROM generate_series('2026-01-01'::date, '2026-05-01'::date, '1 month') d
  LOOP
    RAISE NOTICE 'Purga %', r.ym;
    UPDATE public.invoices SET original_invoice_id = NULL
    WHERE original_invoice_id IN (
      SELECT i.id FROM public.invoices i
      WHERE i.company_id IN (
          '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
          '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
        )
        AND i.issue_date >= r.start_d AND i.issue_date < r.end_d
        AND (
          i.number LIKE 'LEG-%'
          OR COALESCE(i.notes, '') ILIKE '%legacy%'
          OR COALESCE(i.notes, '') ILIKE '%Legacy FACCAB%'
          OR COALESCE(i.notes, '') ILIKE '%Factura legacy%'
          OR i.number ~ '^FAC-[0-9]'
        )
    );
    UPDATE public.invoices SET original_invoice_id = NULL
    WHERE company_id IN (
        '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
        '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
      )
      AND issue_date >= r.start_d AND issue_date < r.end_d
      AND (
        number LIKE 'LEG-%'
        OR COALESCE(notes, '') ILIKE '%legacy%'
        OR COALESCE(notes, '') ILIKE '%Legacy FACCAB%'
        OR COALESCE(notes, '') ILIKE '%Factura legacy%'
        OR number ~ '^FAC-[0-9]'
      );
    DELETE FROM public.invoice_items ii
    USING public.invoices i
    WHERE ii.invoice_id = i.id
      AND i.company_id IN (
        '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
        '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
      )
      AND i.issue_date >= r.start_d AND i.issue_date < r.end_d
      AND COALESCE(i.verifactu_status, '') NOT IN ('sent', 'accepted', 'rejected')
      AND (
        i.number LIKE 'LEG-%'
        OR COALESCE(i.notes, '') ILIKE '%legacy%'
        OR COALESCE(i.notes, '') ILIKE '%Legacy FACCAB%'
        OR COALESCE(i.notes, '') ILIKE '%Factura legacy%'
        OR i.number ~ '^FAC-[0-9]'
      );
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '  items %', n;
    DELETE FROM public.invoices i
    WHERE i.company_id IN (
        '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
        '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
      )
      AND i.issue_date >= r.start_d AND i.issue_date < r.end_d
      AND COALESCE(i.verifactu_status, '') NOT IN ('sent', 'accepted', 'rejected')
      AND (
        i.number LIKE 'LEG-%'
        OR COALESCE(i.notes, '') ILIKE '%legacy%'
        OR COALESCE(i.notes, '') ILIKE '%Legacy FACCAB%'
        OR COALESCE(i.notes, '') ILIKE '%Factura legacy%'
        OR i.number ~ '^FAC-[0-9]'
      );
    GET DIAGNOSTICS n = ROW_COUNT;
    RAISE NOTICE '  invoices %', n;
  END LOOP;
END $purge$;

SELECT to_char(issue_date, 'YYYY-MM') ym, COUNT(*), ROUND(SUM(total_amount)::numeric, 2)
FROM invoices
WHERE issue_date >= '2026-01-01' AND issue_date < '2026-06-01'
  AND company_id IN (
    '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
    '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
  )
GROUP BY 1 ORDER BY 1;
