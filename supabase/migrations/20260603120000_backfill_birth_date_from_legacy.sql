-- Rellena customers.birth_date desde legacy.clientes.fecnac (Dunasoft, formato yyyy-MM-dd).

UPDATE public.customers c
SET
  birth_date = (btrim(l.fecnac))::date,
  updated_at = now()
FROM legacy.clientes l
WHERE l.codcli = c.legacy_codcli
  AND c.legacy_codcli IS NOT NULL
  AND NULLIF(btrim(l.fecnac), '') IS NOT NULL
  AND btrim(l.fecnac) ~ '^\d{4}-\d{2}-\d{2}'
  AND (
    c.birth_date IS NULL
    OR c.birth_date::text <> left(btrim(l.fecnac), 10)
  );
