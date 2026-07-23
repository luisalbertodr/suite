DO $$
DECLARE
  r record;
  n int := 0;
BEGIN
  FOR r IN
    SELECT id FROM public.customers
    WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
      AND archived_at IS NULL
      AND legacy_codcli ~ '^[0-9]+$'
      AND legacy_codcli::bigint >= 10000000
    ORDER BY legacy_codcli::bigint
  LOOP
    UPDATE public.customers
    SET legacy_codcli = public.generate_legacy_codcli(company_id)
    WHERE id = r.id;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'reassigned=%', n;
END $$;

SELECT count(*) AS still_10m FROM customers
WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
  AND legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint >= 10000000;

SELECT legacy_codcli, name FROM customers
WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
  AND name IN (
    'Loli Vazquez Corral','Luisa Garcia Veiga','Ana Valiño Esmoris',
    'María del Mar Lamas Pernas','Yolanda Novoa Reyes','Teresa Bergantiño Insua',
    'Lucia Vizcaino Vazquez','Ana Victoria Aabeiro Garcia'
  )
ORDER BY name;

SELECT max(legacy_codcli::bigint) FILTER (
  WHERE legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint < 1000000
) AS max_style_series
FROM customers
WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL;
