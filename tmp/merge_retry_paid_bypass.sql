-- Reintento merges pendientes con bypass de bloqueo de citas cobradas.
SELECT set_config('app.style_sync_inbound', '1', false);

CREATE TEMP TABLE _merge_pairs (
  winner_id uuid NOT NULL,
  loser_id uuid NOT NULL,
  reason text NOT NULL,
  PRIMARY KEY (loser_id)
);

WITH base AS (
  SELECT id, legacy_codcli, name, tax_id, phone, phone_mobile, phone_home, created_at,
    lower(regexp_replace(
      translate(lower(btrim(name)), 'áéíóúüñ', 'aeiouun'),
      '[^a-z0-9]+', ' ', 'g')) AS nn,
    cardinality(string_to_array(trim(regexp_replace(
      translate(lower(btrim(name)), 'áéíóúüñ', 'aeiouun'),
      '[^a-z0-9]+', ' ', 'g')), ' ')) AS ntok,
    CASE WHEN legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint < 1000000 THEN 0 ELSE 1 END AS suite_penalty,
    CASE WHEN coalesce(nullif(btrim(phone_mobile),''), nullif(btrim(phone),''), nullif(btrim(phone_home),'')) IS NOT NULL THEN 1 ELSE 0 END AS has_phone,
    CASE WHEN coalesce(nullif(btrim(tax_id),''), '') <> '' THEN 1 ELSE 0 END AS has_dni
  FROM public.customers
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    AND archived_at IS NULL
),
eligible AS (
  SELECT *
  FROM base
  WHERE length(nn) >= 8
    AND (
      ntok >= 3
      OR length(nn) >= 16
      OR EXISTS (SELECT 1 FROM base b2 WHERE b2.nn = base.nn AND b2.suite_penalty = 1)
    )
),
ranked AS (
  SELECT *,
    count(*) OVER (PARTITION BY nn) AS grp_n,
    row_number() OVER (
      PARTITION BY nn
      ORDER BY suite_penalty ASC, has_phone DESC, has_dni DESC, created_at ASC NULLS LAST, legacy_codcli
    ) AS rn
  FROM eligible
),
winners AS (SELECT * FROM ranked WHERE grp_n > 1 AND rn = 1),
losers AS (SELECT * FROM ranked WHERE grp_n > 1 AND rn > 1)
INSERT INTO _merge_pairs (winner_id, loser_id, reason)
SELECT w.id, l.id, 'exact_name'
FROM winners w
JOIN losers l ON l.nn = w.nn
ON CONFLICT DO NOTHING;

-- token subset
WITH base AS (
  SELECT id, legacy_codcli, name,
    lower(regexp_replace(translate(lower(btrim(name)), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', ' ', 'g')) AS nn,
    CASE
      WHEN legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint >= 10000000 THEN 'auto'
      WHEN legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint < 1000000 THEN 'style'
      ELSE 'other'
    END AS kind
  FROM public.customers
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
),
autos AS (SELECT * FROM base WHERE kind = 'auto'),
styles AS (SELECT * FROM base WHERE kind = 'style'),
cand AS (
  SELECT a.id AS loser_id, s.id AS winner_id
  FROM autos a
  JOIN styles s ON a.nn <> s.nn AND a.nn <> '' AND s.nn <> ''
  WHERE NOT EXISTS (SELECT 1 FROM styles s2 WHERE s2.nn = a.nn)
    AND (SELECT count(*) FROM unnest(string_to_array(a.nn, ' ')) t(tok) WHERE length(tok) > 2) >= 2
    AND (
      SELECT bool_and(position(' ' || tok || ' ' IN ' ' || s.nn || ' ') > 0)
      FROM unnest(string_to_array(a.nn, ' ')) AS tok
      WHERE length(tok) > 2
    )
)
INSERT INTO _merge_pairs (winner_id, loser_id, reason)
SELECT winner_id, loser_id, 'token_subset'
FROM cand
WHERE (SELECT count(*) FROM cand c2 WHERE c2.loser_id = cand.loser_id) = 1
ON CONFLICT DO NOTHING;

-- DNI
WITH base AS (
  SELECT id, legacy_codcli, tax_id,
    nullif(upper(regexp_replace(coalesce(tax_id, ''), '[^0-9A-Za-z]', '', 'g')), '') AS dni,
    CASE
      WHEN legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint >= 10000000 THEN 'auto'
      WHEN legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint < 1000000 THEN 'style'
      ELSE 'other'
    END AS kind
  FROM public.customers
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
),
autos AS (SELECT * FROM base WHERE kind = 'auto' AND dni IS NOT NULL AND length(dni) >= 7),
styles AS (SELECT * FROM base WHERE kind = 'style' AND dni IS NOT NULL)
INSERT INTO _merge_pairs (winner_id, loser_id, reason)
SELECT s.id, a.id, 'dni'
FROM autos a
JOIN styles s ON s.dni = a.dni
WHERE (SELECT count(*) FROM styles s2 WHERE s2.dni = a.dni) = 1
ON CONFLICT DO NOTHING;

-- Phone
WITH base AS (
  SELECT id, legacy_codcli,
    nullif(right(regexp_replace(coalesce(phone_mobile, phone, phone_home, ''), '[^0-9]', '', 'g'), 9), '') AS phone9,
    CASE
      WHEN legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint >= 10000000 THEN 'auto'
      WHEN legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint < 1000000 THEN 'style'
      ELSE 'other'
    END AS kind
  FROM public.customers
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
),
autos AS (SELECT * FROM base WHERE kind = 'auto' AND phone9 IS NOT NULL AND length(phone9) = 9),
styles AS (SELECT * FROM base WHERE kind = 'style' AND phone9 IS NOT NULL AND length(phone9) = 9)
INSERT INTO _merge_pairs (winner_id, loser_id, reason)
SELECT s.id, a.id, 'phone'
FROM autos a
JOIN styles s ON s.phone9 = a.phone9
WHERE (SELECT count(*) FROM styles s2 WHERE s2.phone9 = a.phone9) = 1
ON CONFLICT DO NOTHING;

SELECT reason, count(*) FROM _merge_pairs GROUP BY 1 ORDER BY 1;

CREATE TEMP TABLE _style_drop AS
SELECT DISTINCT btrim(c.legacy_codcli) AS codcli
FROM _merge_pairs p
JOIN public.customers c ON c.id = p.loser_id
WHERE c.legacy_codcli ~ '^[0-9]+$';

SELECT codcli FROM _style_drop ORDER BY 1;

DO $$
DECLARE
  r record;
  fk record;
  sql text;
  deleted int := 0;
  failed int := 0;
BEGIN
  PERFORM set_config('app.style_sync_inbound', '1', true);
  FOR r IN SELECT winner_id, loser_id, reason FROM _merge_pairs ORDER BY loser_id LOOP
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
        contact_person = COALESCE(NULLIF(btrim(w.contact_person), ''), NULLIF(btrim(l.contact_person), '')),
        notes = CASE
          WHEN NULLIF(btrim(l.notes), '') IS NULL THEN w.notes
          WHEN NULLIF(btrim(w.notes), '') IS NULL THEN l.notes
          WHEN position(l.notes IN coalesce(w.notes, '')) > 0 THEN w.notes
          ELSE btrim(w.notes) || E'\n' || btrim(l.notes)
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
        sql := format('UPDATE public.%I SET %I = $1 WHERE %I = $2', fk.table_name, fk.column_name, fk.column_name);
        EXECUTE sql USING r.winner_id, r.loser_id;
      END LOOP;

      DELETE FROM public.customers WHERE id = r.loser_id;
      deleted := deleted + 1;
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
      RAISE NOTICE 'merge fail loser=% winner=% reason=% err=%', r.loser_id, r.winner_id, r.reason, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'merged=% failed=%', deleted, failed;
END $$;

SELECT set_config('app.style_sync_inbound', '', false);

SELECT count(*) AS ana FROM customers
WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
  AND name ILIKE '%vali_o%esmor%';

SELECT legacy_codcli, name FROM customers
WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
  AND name ILIKE '%vali_o%esmor%';

SELECT count(*) AS suite_auto FROM customers
WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
  AND legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint >= 10000000;

SELECT count(*) AS exact_name_dup_groups FROM (
  SELECT lower(regexp_replace(translate(lower(btrim(name)), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', ' ', 'g')) AS nn
  FROM customers
  WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
  GROUP BY 1
  HAVING count(*)>1 AND length(min(lower(regexp_replace(translate(lower(btrim(name)), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', ' ', 'g')))) >= 12
) t;
