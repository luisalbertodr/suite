DO $do$
DECLARE
  rec record;
  v_code text;
  v_company uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid;
  n int := 0;
BEGIN
  FOR rec IN
    SELECT id, COALESCE(company_id, v_company) AS company_id
    FROM public.customers
    WHERE legacy_codcli IS NULL OR btrim(legacy_codcli) = ''
    ORDER BY created_at NULLS LAST, id
  LOOP
    v_code := public.generate_legacy_codcli(rec.company_id);
    UPDATE public.customers
    SET legacy_codcli = v_code,
        company_id = COALESCE(company_id, rec.company_id),
        updated_at = now()
    WHERE id = rec.id;
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'legacy_codcli asignados: %', n;
END $do$;

SELECT COUNT(*) AS restantes
FROM public.customers
WHERE legacy_codcli IS NULL OR btrim(legacy_codcli) = '';
