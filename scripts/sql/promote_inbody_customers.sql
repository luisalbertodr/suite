-- Crear fichas de clientes para mediciones InBody CSV sin customer_id y re-vincular.
WITH company AS (
  SELECT id FROM companies WHERE name ILIKE '%Mar%Lamas%' LIMIT 1
),
missing AS (
  SELECT DISTINCT m.inbody_user_id
  FROM inbody_measurements m
  JOIN company c ON c.id = m.company_id
  WHERE m.customer_id IS NULL
    AND m.source = 'lookinbody_dbbackup_csv'
    AND nullif(btrim(m.inbody_user_id), '') IS NOT NULL
),
inserted AS (
  INSERT INTO customers (id, company_id, name, tax_id)
  SELECT
    gen_random_uuid(),
    (SELECT id FROM company),
    coalesce(
      (
        SELECT nullif(trim(concat_ws(' ', nullif(trim(lc.nomcli), ''), nullif(trim(lc.ape1cli), ''))), '')
        FROM legacy.clientes lc
        WHERE nullif(btrim(lc.dnicli), '') IS NOT NULL
          AND regexp_replace(lc.dnicli, '\D', '', 'g') = regexp_replace(m.inbody_user_id, '\D', '', 'g')
        ORDER BY length(trim(concat_ws(' ', lc.nomcli, lc.ape1cli))) DESC
        LIMIT 1
      ),
      'Paciente InBody ' || upper(m.inbody_user_id)
    ),
    lower(
      CASE
        WHEN m.inbody_user_id ~ '^\d{7,8}$' THEN
          lpad(m.inbody_user_id, 8, '0') ||
          substr('TRWAGMYFPDXBNJZSQVHLCKE', ((lpad(m.inbody_user_id, 8, '0')::bigint % 23) + 1)::int, 1)
        ELSE m.inbody_user_id
      END
    )
  FROM missing m
  WHERE NOT EXISTS (
    SELECT 1 FROM customers cu
    JOIN company c ON c.id = cu.company_id
    WHERE regexp_replace(coalesce(cu.tax_id, ''), '\D', '', 'g')
        = regexp_replace(m.inbody_user_id, '\D', '', 'g')
  )
  RETURNING id, tax_id, name
)
SELECT count(*) AS fichas_creadas FROM inserted;

UPDATE inbody_measurements m
SET customer_id = cu.id, updated_at = now()
FROM customers cu,
     (SELECT id FROM companies WHERE name ILIKE '%Mar%Lamas%' LIMIT 1) c
WHERE m.company_id = c.id
  AND cu.company_id = c.id
  AND m.customer_id IS NULL
  AND m.source = 'lookinbody_dbbackup_csv'
  AND regexp_replace(coalesce(cu.tax_id, ''), '\D', '', 'g')
    = regexp_replace(m.inbody_user_id, '\D', '', 'g');

SELECT count(*) FILTER (WHERE customer_id IS NOT NULL) AS vinculadas,
       count(*) FILTER (WHERE customer_id IS NULL) AS sin_ficha
FROM inbody_measurements
WHERE source = 'lookinbody_dbbackup_csv';
