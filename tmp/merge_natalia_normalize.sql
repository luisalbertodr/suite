-- Merge Natalia + archivar vacíos + normalizar client_name
-- Empresa: María del Mar Lamas Pernas

BEGIN;

-- Permitir normalizar client_name también en citas cobradas (solo esta sesión)
SELECT set_config('app.style_sync_inbound', '1', true);

-- IDs Natalia
-- keep: 055e59f1-4f2e-4e08-b289-0be3a9958936
-- drop: f4b724af-922c-468e-8659-05bf37cbaa4c

DO $$
DECLARE
  keep_id uuid := '055e59f1-4f2e-4e08-b289-0be3a9958936';
  drop_id uuid := 'f4b724af-922c-468e-8659-05bf37cbaa4c';
  company uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
  t text;
  n int;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'agenda_appointments',
    'bonos',
    'consentimientos',
    'customer_aesthetic_history',
    'customer_contacts',
    'customer_questionnaires',
    'customer_shipping_addresses',
    'customer_vouchers',
    'daily_customer_log',
    'delivery_notes',
    'historial_clinico',
    'historial_clinico_revisiones',
    'inbody_measurements',
    'invoices',
    'marketing_leads',
    'presupuestos_n',
    'quotes',
    'sale_groups',
    'sales',
    'scale_weigh_requests',
    'vehicles',
    'whatsapp_chats',
    'work_orders'
  ]
  LOOP
    EXECUTE format(
      'UPDATE %I SET customer_id = $1 WHERE customer_id = $2',
      t
    ) USING keep_id, drop_id;
    GET DIAGNOSTICS n = ROW_COUNT;
    IF n > 0 THEN
      RAISE NOTICE 'reassigned % rows in %', n, t;
    END IF;
  END LOOP;

  UPDATE customers
  SET archived_at = now()
  WHERE id = drop_id
    AND company_id = company
    AND archived_at IS NULL;
END $$;

-- Archivar fichas vacías "Cliente XXXXX" duplicadas (sin teléfono útil)
UPDATE customers
SET archived_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND archived_at IS NULL
  AND legacy_codcli IN ('007098', '007256', '008182')
  AND name ~* '^Cliente[[:space:]]*[0-9]+$'
  AND coalesce(nullif(phone_mobile, ''), nullif(phone, ''), nullif(phone_home, '')) IS NULL;

-- Normalizar client_name de citas al nombre canónico de customers
-- Preferir match por customer_id; si no, por legacy_codcli (variantes con/sin ceros)
WITH canon AS (
  SELECT DISTINCT ON (norm_cod)
    id,
    name,
    legacy_codcli,
    ltrim(legacy_codcli, '0') AS norm_cod
  FROM customers
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    AND archived_at IS NULL
    AND legacy_codcli IS NOT NULL
    AND legacy_codcli NOT IN ('', '0')
    AND nullif(trim(name), '') IS NOT NULL
    AND name !~* '^Cliente[[:space:]]*[0-9]+$'
  ORDER BY
    ltrim(legacy_codcli, '0'),
    (coalesce(nullif(phone_mobile, ''), nullif(phone, ''), nullif(phone_home, '')) IS NOT NULL) DESC,
    created_at ASC
),
by_id AS (
  UPDATE agenda_appointments a
  SET client_name = c.name
  FROM customers c
  WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    AND a.customer_id = c.id
    AND c.company_id = a.company_id
    AND c.archived_at IS NULL
    AND nullif(trim(c.name), '') IS NOT NULL
    AND c.name !~* '^Cliente[[:space:]]*[0-9]+$'
    AND a.client_name IS DISTINCT FROM c.name
  RETURNING a.id
),
by_legacy AS (
  UPDATE agenda_appointments a
  SET client_name = canon.name
  FROM canon
  WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    AND a.customer_id IS NULL
    AND a.legacy_codcli IS NOT NULL
    AND a.legacy_codcli NOT IN ('', '0')
    AND ltrim(a.legacy_codcli, '0') = canon.norm_cod
    AND a.client_name IS DISTINCT FROM canon.name
  RETURNING a.id
)
SELECT
  (SELECT count(*) FROM by_id) AS updated_by_customer_id,
  (SELECT count(*) FROM by_legacy) AS updated_by_legacy;

-- Verificación
SELECT id, name, legacy_codcli, archived_at IS NOT NULL AS archived
FROM customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND legacy_codcli IN ('007098', '007256', '007375', '008182', '008260')
ORDER BY legacy_codcli, archived, name;

SELECT DISTINCT client_name, legacy_codcli
FROM agenda_appointments
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND legacy_codcli = '007375';

COMMIT;
