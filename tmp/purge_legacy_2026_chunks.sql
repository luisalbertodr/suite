-- Purga por lotes (evita bloqueos FK largos). Ene-may 2026.

CREATE TEMP TABLE IF NOT EXISTS _purge_ids (id uuid PRIMARY KEY);

DO $purge$
DECLARE
  batch int;
  total int := 0;
BEGIN
  LOOP
    TRUNCATE _purge_ids;
    INSERT INTO _purge_ids
    SELECT i.id
    FROM public.invoices i
    WHERE i.company_id IN (
        '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid,
        '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid
      )
      AND i.issue_date >= DATE '2026-01-01'
      AND i.issue_date < DATE '2026-06-01'
      AND COALESCE(i.verifactu_status, '') NOT IN ('sent', 'accepted', 'rejected')
      AND (
        i.number LIKE 'LEG-%'
        OR COALESCE(i.notes, '') ILIKE '%legacy%'
        OR COALESCE(i.notes, '') ILIKE '%Legacy FACCAB%'
        OR COALESCE(i.notes, '') ILIKE '%Factura legacy%'
        OR i.number ~ '^FAC-[0-9]'
      )
    LIMIT 200;

    GET DIAGNOSTICS batch = ROW_COUNT;
    EXIT WHEN batch = 0;

    UPDATE public.invoices SET original_invoice_id = NULL
    WHERE original_invoice_id IN (SELECT id FROM _purge_ids);

    UPDATE public.invoices SET original_invoice_id = NULL
    WHERE id IN (SELECT id FROM _purge_ids);

    DELETE FROM public.invoice_items WHERE invoice_id IN (SELECT id FROM _purge_ids);
    UPDATE public.sales SET invoice_id = NULL WHERE invoice_id IN (SELECT id FROM _purge_ids);
    DELETE FROM public.invoices WHERE id IN (SELECT id FROM _purge_ids);

    total := total + batch;
    RAISE NOTICE 'Lote % facturas (acum %)', batch, total;
    COMMIT;
  END LOOP;
  RAISE NOTICE 'Total purgadas: %', total;
END $purge$;

SELECT to_char(issue_date, 'YYYY-MM') ym, COUNT(*), ROUND(SUM(total_amount)::numeric, 2)
FROM invoices
WHERE issue_date >= '2026-01-01' AND issue_date < '2026-06-01'
GROUP BY 1 ORDER BY 1;
