-- Separar personas distintas: corregir legacy_codcli de citas mal etiquetadas
-- (ya tienen customer_id apuntando a su ficha correcta).

BEGIN;
SELECT set_config('app.style_sync_inbound', '1', true);

-- 1) Citas con FK: alinear legacy_codcli (+ nombre) al de su customer
WITH upd AS (
  UPDATE agenda_appointments a
  SET
    legacy_codcli = c.legacy_codcli,
    client_name = c.name
  FROM customers c
  WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    AND a.customer_id = c.id
    AND c.company_id = a.company_id
    AND c.archived_at IS NULL
    AND nullif(trim(c.legacy_codcli), '') IS NOT NULL
    AND c.legacy_codcli NOT IN ('0')
    AND (
      a.legacy_codcli IS DISTINCT FROM c.legacy_codcli
      OR a.client_name IS DISTINCT FROM c.name
    )
    -- solo cuando el código actual no es el mismo (ignorando ceros)
    AND ltrim(coalesce(nullif(a.legacy_codcli, ''), '0'), '0')
        IS DISTINCT FROM ltrim(c.legacy_codcli, '0')
  RETURNING a.id, a.client_name, a.legacy_codcli
)
SELECT count(*) AS fixed_by_customer_fk FROM upd;

-- 2) Los 6 casos problemáticos por nombre (por si alguna quedó sin FK)
-- Laura Otero Gallego → 006290
UPDATE agenda_appointments a
SET
  customer_id = c.id,
  legacy_codcli = c.legacy_codcli,
  client_name = c.name
FROM customers c
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND c.id = 'e6019715-2272-49d6-bcf5-809d5472c2a3'
  AND a.client_name ILIKE 'Laura Otero Gallego'
  AND ltrim(coalesce(a.legacy_codcli, '0'), '0') IN ('5377')
  AND (
    a.customer_id IS DISTINCT FROM c.id
    OR a.legacy_codcli IS DISTINCT FROM c.legacy_codcli
  );

-- Alba Suarez Varela → 001374
UPDATE agenda_appointments a
SET
  customer_id = c.id,
  legacy_codcli = c.legacy_codcli,
  client_name = c.name
FROM customers c
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND c.id = '879cb3ee-9e36-4df6-80ee-083b797231bb'
  AND a.client_name ILIKE 'Alba Suarez Varela'
  AND ltrim(coalesce(a.legacy_codcli, '0'), '0') IN ('539')
  AND (
    a.customer_id IS DISTINCT FROM c.id
    OR a.legacy_codcli IS DISTINCT FROM c.legacy_codcli
  );

-- Iago Diaz Lamas → 005155
UPDATE agenda_appointments a
SET
  customer_id = c.id,
  legacy_codcli = c.legacy_codcli,
  client_name = c.name
FROM customers c
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND c.id = 'ae83d3e5-76b9-4e04-9eae-1cb64061594a'
  AND a.client_name ILIKE 'Iago Diaz Lamas'
  AND ltrim(coalesce(a.legacy_codcli, '0'), '0') IN ('553')
  AND (
    a.customer_id IS DISTINCT FROM c.id
    OR a.legacy_codcli IS DISTINCT FROM c.legacy_codcli
  );

-- Yolanda Novoa Reyes → 008263
UPDATE agenda_appointments a
SET
  customer_id = c.id,
  legacy_codcli = c.legacy_codcli,
  client_name = c.name
FROM customers c
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND c.id = '917e98cc-3d95-403f-ab3f-ebc7f682f94a'
  AND a.client_name ILIKE 'Yolanda Novoa Reyes'
  AND ltrim(coalesce(a.legacy_codcli, '0'), '0') IN ('6621')
  AND (
    a.customer_id IS DISTINCT FROM c.id
    OR a.legacy_codcli IS DISTINCT FROM c.legacy_codcli
  );

-- Teresa Lago Verdura → 007939
UPDATE agenda_appointments a
SET
  customer_id = c.id,
  legacy_codcli = c.legacy_codcli,
  client_name = c.name
FROM customers c
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND c.id = '818358bc-3ee1-4081-bcbb-fe6c9f98062b'
  AND a.client_name ILIKE 'Teresa Lago Verdura'
  AND ltrim(coalesce(a.legacy_codcli, '0'), '0') IN ('7946')
  AND (
    a.customer_id IS DISTINCT FROM c.id
    OR a.legacy_codcli IS DISTINCT FROM c.legacy_codcli
  );

-- Paula Varela Garcia → 007376
UPDATE agenda_appointments a
SET
  customer_id = c.id,
  legacy_codcli = c.legacy_codcli,
  client_name = c.name
FROM customers c
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND c.id = 'cdfe749d-a56d-475d-9374-5623edf4fabb'
  AND a.client_name ILIKE 'Paula Varela Garcia'
  AND ltrim(coalesce(a.legacy_codcli, '0'), '0') IN ('8053')
  AND (
    a.customer_id IS DISTINCT FROM c.id
    OR a.legacy_codcli IS DISTINCT FROM c.legacy_codcli
  );

-- Verificación: ¿quedan códigos con varios nombres?
SELECT a.legacy_codcli,
       array_agg(DISTINCT a.client_name ORDER BY a.client_name) AS nombres,
       count(*) AS citas
FROM agenda_appointments a
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND a.legacy_codcli IS NOT NULL AND a.legacy_codcli NOT IN ('', '0')
  AND a.status IS DISTINCT FROM 'cancelled'
GROUP BY a.legacy_codcli
HAVING count(DISTINCT a.client_name) > 1
ORDER BY count(*) DESC
LIMIT 15;

COMMIT;
