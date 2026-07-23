-- Tras fix invoices_enqueue: reasignar facturas de [DUP] archivados y borrar si ya no tienen FKs.
SELECT set_config('app.style_sync_inbound', '1', false);

DO $$
DECLARE
  r record;
  w uuid;
  deleted int := 0;
  failed int := 0;
BEGIN
  PERFORM set_config('app.style_sync_inbound', '1', true);

  FOR r IN
    SELECT id, name, legacy_codcli,
      lower(regexp_replace(translate(lower(btrim(regexp_replace(name, '^\[DUP\]\s*', '', 'i'))), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', ' ', 'g')) AS nn
    FROM public.customers
    WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
      AND archived_at IS NOT NULL
      AND name ILIKE '[DUP]%'
  LOOP
    SELECT c.id INTO w
    FROM public.customers c
    WHERE c.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
      AND c.archived_at IS NULL
      AND lower(regexp_replace(translate(lower(btrim(c.name)), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', ' ', 'g')) = r.nn
    ORDER BY CASE WHEN c.legacy_codcli ~ '^[0-9]+$' AND c.legacy_codcli::bigint < 1000000 THEN 0 ELSE 1 END,
             c.created_at ASC NULLS LAST
    LIMIT 1;

    IF w IS NULL THEN
      CONTINUE;
    END IF;

    BEGIN
      UPDATE public.invoices SET customer_id = w WHERE customer_id = r.id;
      UPDATE public.agenda_appointments SET customer_id = w WHERE customer_id = r.id;
      UPDATE public.sales SET customer_id = w WHERE customer_id = r.id;
      UPDATE public.sale_groups SET customer_id = w WHERE customer_id = r.id;
      DELETE FROM public.customers WHERE id = r.id;
      deleted := deleted + 1;
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
      RAISE NOTICE 'finish fail % -> %: %', r.legacy_codcli, w, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'dup_deleted=% failed=%', deleted, failed;
END $$;

SELECT set_config('app.style_sync_inbound', '', false);

SELECT legacy_codcli, name FROM customers
WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (name ILIKE '%vali_o%esmor%' OR name ILIKE '%[DUP]%vali%');

SELECT count(*) AS suite_auto FROM customers
WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
  AND legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint >= 10000000;

SELECT legacy_codcli, name FROM customers
WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
  AND legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint >= 10000000
ORDER BY legacy_codcli::bigint;
