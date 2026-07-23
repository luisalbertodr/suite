-- 1) Borrar pruebas Suite 10000000-06
-- 2) Merge duplicados exactos (nombre normalizado) + token-subset únicos
-- 3) Reasignar 9999998/9999999 a serie Style
-- Company: María del Mar Lamas Pernas

CREATE TEMP TABLE _del_ids AS
SELECT id, legacy_codcli, name
FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND archived_at IS NULL
  AND legacy_codcli ~ '^[0-9]+$'
  AND legacy_codcli::bigint BETWEEN 10000000 AND 10000006;

CREATE TEMP TABLE _merge_pairs (
  winner_id uuid NOT NULL,
  loser_id uuid NOT NULL,
  reason text NOT NULL,
  PRIMARY KEY (loser_id)
);

-- Exact name groups → winner = Style series preferido + teléfono/DNI + más antiguo
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
  -- Evitar fusiones peligrosas de nombres cortos/genéricos salvo que haya auto 10M+
  SELECT *
  FROM base
  WHERE length(nn) >= 8
    AND (
      ntok >= 3
      OR length(nn) >= 16
      OR EXISTS (
        SELECT 1 FROM base b2
        WHERE b2.nn = base.nn AND b2.suite_penalty = 1
      )
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

-- Token subset: autos sin exact match → Style único que contiene todos los tokens (>2)
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
  AND loser_id NOT IN (SELECT loser_id FROM _merge_pairs)
  AND loser_id NOT IN (SELECT id FROM _del_ids)
ON CONFLICT DO NOTHING;

-- DNI único auto → style
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
  AND a.id NOT IN (SELECT loser_id FROM _merge_pairs)
  AND a.id NOT IN (SELECT id FROM _del_ids)
ON CONFLICT DO NOTHING;

CREATE TEMP TABLE _style_drop_codes AS
SELECT DISTINCT btrim(c.legacy_codcli) AS codcli
FROM _merge_pairs p
JOIN public.customers c ON c.id = p.loser_id
WHERE c.legacy_codcli ~ '^[0-9]+$'
UNION
SELECT legacy_codcli FROM _del_ids
UNION
SELECT '10000068';

SELECT reason, count(*) FROM _merge_pairs GROUP BY 1 ORDER BY 1;
SELECT count(*) AS pairs FROM _merge_pairs;
SELECT legacy_codcli, name FROM _del_ids ORDER BY legacy_codcli;
SELECT codcli AS style_drop FROM _style_drop_codes ORDER BY codcli;

DO $$
DECLARE
  r record;
  fk record;
  sql text;
  deleted int := 0;
  failed int := 0;
  purged int := 0;
BEGIN
  -- Merges
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

  -- Purge test accounts 10000000-06
  FOR r IN SELECT id, legacy_codcli FROM _del_ids LOOP
    BEGIN
      UPDATE public.customers
      SET phone = NULL, phone_home = NULL, phone_mobile = NULL
      WHERE id = r.id;

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
        -- borrar dependencias huérfanas no siempre posible; intentar null si nullable, else skip
        BEGIN
          sql := format('DELETE FROM public.%I WHERE %I = $1', fk.table_name, fk.column_name);
          EXECUTE sql USING r.id;
        EXCEPTION WHEN OTHERS THEN
          RAISE NOTICE 'purge fk skip %.% for %: %', fk.table_name, fk.column_name, r.legacy_codcli, SQLERRM;
        END;
      END LOOP;

      DELETE FROM public.customers WHERE id = r.id;
      purged := purged + 1;
    EXCEPTION WHEN OTHERS THEN
      failed := failed + 1;
      RAISE NOTICE 'purge fail %: %', r.legacy_codcli, SQLERRM;
    END;
  END LOOP;

  RAISE NOTICE 'merged=% purged=% failed=%', deleted, purged, failed;
END $$;

-- Reasignar códigos basura 9999998/9999999 a serie Style (si siguen existiendo)
DO $$
DECLARE
  v_yolanda uuid;
  v_teresa uuid;
  v_next text;
BEGIN
  SELECT id INTO v_yolanda FROM public.customers
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    AND legacy_codcli IN ('9999998') AND archived_at IS NULL;
  SELECT id INTO v_teresa FROM public.customers
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    AND legacy_codcli IN ('9999999') AND archived_at IS NULL;

  IF v_yolanda IS NOT NULL THEN
    -- Asignar temporalmente vacío no permitido por trigger; usar generate
    UPDATE public.customers SET legacy_codcli = public.generate_legacy_codcli(company_id)
    WHERE id = v_yolanda;
  END IF;
  IF v_teresa IS NOT NULL THEN
    UPDATE public.customers SET legacy_codcli = public.generate_legacy_codcli(company_id)
    WHERE id = v_teresa;
  END IF;
END $$;

-- Limpiar espejo dunasoft de códigos basura / pruebas
DELETE FROM dunasoft.clientes
WHERE btrim(codcli) ~ '^[0-9]+$'
  AND (
    btrim(codcli)::bigint BETWEEN 10000000 AND 10000006
    OR btrim(codcli)::bigint IN (10000068, 9999998, 9999999)
  );

SELECT count(*) AS suite_auto_left FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND archived_at IS NULL
  AND legacy_codcli ~ '^[0-9]+$' AND legacy_codcli::bigint >= 10000000;

SELECT legacy_codcli, name FROM public.customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
  AND lower(regexp_replace(translate(lower(btrim(name)), 'áéíóúüñ', 'aeiouun'), '[^a-z0-9]+', ' ', 'g'))
      = 'ana vali o esmoris';

SELECT legacy_codcli, name FROM public.customers
WHERE id IN (
  SELECT id FROM public.customers
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    AND name ILIKE '%Yolanda Novoa%' OR name ILIKE '%Teresa Berganti%'
) AND company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
