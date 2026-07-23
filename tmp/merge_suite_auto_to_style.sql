-- Merge: suite_auto (legacy_codcli >= 10M) → Style (< 10M) por DNI / teléfono / nombre único.

CREATE TEMP TABLE _merge_pairs (
  winner_id uuid NOT NULL,
  loser_id uuid NOT NULL,
  reason text NOT NULL,
  PRIMARY KEY (loser_id)
);

WITH base AS (
  SELECT id, company_id, name, legacy_codcli, phone, phone_mobile, phone_home, tax_id,
    lower(regexp_replace(
      translate(btrim(name), 'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNAEIOUUN'),
      '[^a-z0-9]+', ' ', 'g'
    )) AS n,
    nullif(regexp_replace(coalesce(phone_mobile, phone, phone_home, ''), '[^0-9]', '', 'g'), '') AS phone_digits,
    nullif(upper(regexp_replace(coalesce(tax_id, ''), '[^0-9A-Za-z]', '', 'g')), '') AS dni,
    CASE
      WHEN legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint >= 10000000 THEN 'suite_auto'
      WHEN legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint < 10000000 THEN 'style'
      ELSE 'other'
    END AS kind
  FROM public.customers
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    AND archived_at IS NULL
),
autos AS (SELECT * FROM base WHERE kind = 'suite_auto'),
styles AS (SELECT * FROM base WHERE kind = 'style'),
by_unique_name AS (
  SELECT s.id AS winner_id, a.id AS loser_id, 'unique_name'::text AS reason
  FROM autos a
  JOIN styles s ON s.n = a.n AND s.company_id = a.company_id
  WHERE (SELECT count(*) FROM styles s2 WHERE s2.n = a.n AND s2.company_id = a.company_id) = 1
),
by_dni AS (
  SELECT s.id AS winner_id, a.id AS loser_id, 'dni'::text AS reason
  FROM autos a
  JOIN styles s ON s.dni IS NOT NULL AND a.dni IS NOT NULL AND s.dni = a.dni AND s.company_id = a.company_id
  WHERE (SELECT count(*) FROM styles s2 WHERE s2.dni = a.dni AND s2.company_id = a.company_id) = 1
),
by_phone AS (
  SELECT s.id AS winner_id, a.id AS loser_id, 'phone'::text AS reason
  FROM autos a
  JOIN styles s
    ON s.phone_digits IS NOT NULL AND a.phone_digits IS NOT NULL
   AND length(a.phone_digits) >= 9
   AND s.phone_digits = a.phone_digits
   AND s.company_id = a.company_id
  WHERE (SELECT count(*) FROM styles s2 WHERE s2.phone_digits = a.phone_digits AND s2.company_id = a.company_id) = 1
),
ranked AS (
  SELECT *, ROW_NUMBER() OVER (
    PARTITION BY loser_id
    ORDER BY CASE reason WHEN 'dni' THEN 1 WHEN 'phone' THEN 2 ELSE 3 END
  ) AS rn
  FROM (
    SELECT * FROM by_dni
    UNION ALL
    SELECT * FROM by_phone
    UNION ALL
    SELECT * FROM by_unique_name
  ) u
)
INSERT INTO _merge_pairs (winner_id, loser_id, reason)
SELECT winner_id, loser_id, reason
FROM ranked
WHERE rn = 1;

SELECT reason, count(*) AS n FROM _merge_pairs GROUP BY reason ORDER BY 1;
SELECT count(*) AS pairs FROM _merge_pairs;

DO $$
DECLARE
  r record;
  fk record;
  sql text;
  deleted int := 0;
  failed int := 0;
BEGIN
  FOR r IN SELECT winner_id, loser_id, reason FROM _merge_pairs ORDER BY loser_id LOOP
    BEGIN
      -- Rellenar huecos del winner ANTES de limpiar teléfonos del loser
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
          WHEN position(l.notes in coalesce(w.notes, '')) > 0 THEN w.notes
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
        sql := format(
          'UPDATE public.%I SET %I = $1 WHERE %I = $2',
          fk.table_name, fk.column_name, fk.column_name
        );
        EXECUTE sql USING r.winner_id, r.loser_id;
      END LOOP;

      DELETE FROM public.customers WHERE id = r.loser_id;
      deleted := deleted + 1;
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
      RAISE NOTICE 'merge fail loser=% winner=% reason=% err=%', r.loser_id, r.winner_id, r.reason, SQLERRM;
    END;
  END LOOP;
  RAISE NOTICE 'merged_deleted=% failed=%', deleted, failed;
END $$;

SELECT count(*) AS suite_auto_remaining FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND archived_at IS NULL
  AND legacy_codcli ~ '^[0-9]+$'
  AND legacy_codcli::bigint >= 10000000;

SELECT count(*) AS jeni_rows FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND archived_at IS NULL
  AND lower(btrim(name)) = lower('Jeni Estevez Rodriguez');
