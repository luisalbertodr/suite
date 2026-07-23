-- Merge robusto: savepoint por FK; si no se puede borrar, archiva el loser.
SELECT set_config('app.style_sync_inbound', '1', false);

CREATE TEMP TABLE _pairs (
  winner_id uuid NOT NULL,
  loser_id uuid NOT NULL,
  reason text NOT NULL,
  PRIMARY KEY (loser_id)
);

-- Solo casos claros restantes: Ana + grupos con suite_auto + style same name + token/dni/phone
WITH base AS (
  SELECT id, legacy_codcli, name, tax_id, phone, phone_mobile, phone_home, created_at,
    lower(regexp_replace(translate(lower(btrim(name)), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', ' ', 'g')) AS nn,
    cardinality(string_to_array(trim(regexp_replace(translate(lower(btrim(name)), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', ' ', 'g')), ' ')) AS ntok,
    CASE WHEN legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint < 1000000 THEN 0 ELSE 1 END AS suite_penalty,
    CASE WHEN coalesce(nullif(btrim(phone_mobile),''), nullif(btrim(phone),''), nullif(btrim(phone_home),'')) IS NOT NULL THEN 1 ELSE 0 END AS has_phone,
    CASE WHEN coalesce(nullif(btrim(tax_id),''), '') <> '' THEN 1 ELSE 0 END AS has_dni
  FROM public.customers
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
),
eligible AS (
  SELECT * FROM base
  WHERE length(nn) >= 8 AND (
    ntok >= 3 OR length(nn) >= 16
    OR EXISTS (SELECT 1 FROM base b2 WHERE b2.nn = base.nn AND b2.suite_penalty = 1)
  )
),
ranked AS (
  SELECT *, count(*) OVER (PARTITION BY nn) AS grp_n,
    row_number() OVER (PARTITION BY nn ORDER BY suite_penalty, has_phone DESC, has_dni DESC, created_at ASC NULLS LAST, legacy_codcli) AS rn
  FROM eligible
)
INSERT INTO _pairs
SELECT w.id, l.id, 'exact_name'
FROM ranked w
JOIN ranked l ON l.nn = w.nn AND l.rn > 1
WHERE w.rn = 1 AND w.grp_n > 1
ON CONFLICT DO NOTHING;

-- Forzar Ana 007897 -> 002243
INSERT INTO _pairs VALUES
  ('0b8682f2-1724-4d8d-adc8-0eddfc9a2978', 'f2333819-2235-46a3-98af-d18e7df4acba', 'ana_manual')
ON CONFLICT DO NOTHING;

SELECT count(*) AS pairs FROM _pairs;

DO $$
DECLARE
  r record;
  fk record;
  sql text;
  deleted int := 0;
  archived int := 0;
  failed int := 0;
  moved int;
BEGIN
  PERFORM set_config('app.style_sync_inbound', '1', true);

  FOR r IN SELECT * FROM _pairs ORDER BY loser_id LOOP
    BEGIN
      UPDATE public.customers w
      SET
        tax_id = COALESCE(NULLIF(btrim(w.tax_id), ''), NULLIF(btrim(l.tax_id), '')),
        email = COALESCE(NULLIF(btrim(w.email), ''), NULLIF(btrim(l.email), '')),
        phone = COALESCE(NULLIF(btrim(w.phone), ''), NULLIF(btrim(l.phone), '')),
        phone_home = COALESCE(NULLIF(btrim(w.phone_home), ''), NULLIF(btrim(l.phone_home), '')),
        phone_mobile = COALESCE(NULLIF(btrim(w.phone_mobile), ''), NULLIF(btrim(l.phone_mobile), '')),
        address_street = COALESCE(NULLIF(btrim(w.address_street), ''), NULLIF(btrim(l.address_street), '')),
        address_city = COALESCE(NULLIF(btrim(w.address_city), ''), NULLIF(btrim(l.address_city), '')),
        address_state = COALESCE(NULLIF(btrim(w.address_state), ''), NULLIF(btrim(l.address_state), '')),
        address_postal_code = COALESCE(NULLIF(btrim(w.address_postal_code), ''), NULLIF(btrim(l.address_postal_code), '')),
        address_country = COALESCE(NULLIF(btrim(w.address_country), ''), NULLIF(btrim(l.address_country), '')),
        notes = CASE
          WHEN NULLIF(btrim(l.notes), '') IS NULL THEN w.notes
          WHEN NULLIF(btrim(w.notes), '') IS NULL THEN l.notes
          ELSE btrim(coalesce(w.notes,'')) || E'\n' || btrim(l.notes)
        END,
        birth_date = COALESCE(w.birth_date, l.birth_date)
      FROM public.customers l
      WHERE w.id = r.winner_id AND l.id = r.loser_id;

      UPDATE public.customers
      SET phone = NULL, phone_home = NULL, phone_mobile = NULL
      WHERE id = r.loser_id;

      FOR fk IN
        SELECT tc.table_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_schema = 'public'
          AND ccu.table_name = 'customers'
          AND ccu.column_name = 'id'
      LOOP
        BEGIN
          sql := format('UPDATE public.%I SET %I = $1 WHERE %I = $2', fk.table_name, fk.column_name, fk.column_name);
          EXECUTE sql USING r.winner_id, r.loser_id;
          GET DIAGNOSTICS moved = ROW_COUNT;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'skip fk %.% loser=%: %', fk.table_name, fk.column_name, r.loser_id, SQLERRM;
        END;
      END LOOP;

      BEGIN
        DELETE FROM public.customers WHERE id = r.loser_id;
        deleted := deleted + 1;
      EXCEPTION WHEN OTHERS THEN
        UPDATE public.customers
        SET archived_at = coalesce(archived_at, now()),
            name = left('[DUP] ' || name, 200)
        WHERE id = r.loser_id AND archived_at IS NULL;
        archived := archived + 1;
        RAISE NOTICE 'archived loser=% because delete failed: %', r.loser_id, SQLERRM;
      END;
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
      RAISE NOTICE 'pair fail loser=%: %', r.loser_id, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'deleted=% archived=% failed=%', deleted, archived, failed;
END $$;

SELECT set_config('app.style_sync_inbound', '', false);

SELECT legacy_codcli, name, archived_at IS NOT NULL AS arch FROM customers
WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (name ILIKE '%vali_o%esmor%' OR legacy_codcli IN ('002243','007897'));

SELECT count(*) AS suite_auto_active FROM customers
WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
  AND legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint >= 10000000;
