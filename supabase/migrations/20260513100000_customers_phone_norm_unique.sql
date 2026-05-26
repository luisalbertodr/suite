-- Unicidad por empresa del teléfono principal normalizado (últimos 9 dígitos; prioriza móvil > phone > casa).
-- Si ya hay duplicados con el mismo (company_id, phone_norm), se consolidan antes del índice único:
--   se elige ganador (created_at más antigua, tie-break por id).
--   se reescriben todas las FK públicas → customers(id).
--   se borran filas cliente duplicadas.

CREATE OR REPLACE FUNCTION public.customer_primary_phone_last9(
  p_phone text,
  p_mobile text,
  p_home text
)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT NULLIF(
    CASE
      WHEN length(regexp_replace(COALESCE(p_mobile, ''), '\D', '', 'g')) >= 9
        THEN right(regexp_replace(COALESCE(p_mobile, ''), '\D', '', 'g'), 9)
      WHEN length(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')) >= 9
        THEN right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 9)
      WHEN length(regexp_replace(COALESCE(p_home, ''), '\D', '', 'g')) >= 9
        THEN right(regexp_replace(COALESCE(p_home, ''), '\D', '', 'g'), 9)
      ELSE NULL
    END,
    ''
  );
$$;

COMMENT ON FUNCTION public.customer_primary_phone_last9(text, text, text) IS
  'Clave de deduplicación de teléfono: últimos 9 dígitos del primer campo con longitud suficiente (móvil, luego phone, luego casa).';

DROP INDEX IF EXISTS public.customers_company_phone_norm_uidx;

ALTER TABLE public.customers
  DROP COLUMN IF EXISTS phone_norm;

ALTER TABLE public.customers
  ADD COLUMN phone_norm text
  GENERATED ALWAYS AS (
    public.customer_primary_phone_last9(phone, phone_mobile, phone_home)
  ) STORED;

COMMENT ON COLUMN public.customers.phone_norm IS
  'Generado: últimos 9 dígitos del teléfono principal para unicidad por empresa.';

-- Duplicados: mapa loser_id → winner_id (no toca filas ganador).
CREATE TEMP TABLE _customer_phone_dup_map (
  loser_id uuid NOT NULL PRIMARY KEY,
  winner_id uuid NOT NULL
) ON COMMIT DROP;

WITH dup_groups AS (
  SELECT
    company_id,
    phone_norm,
    (array_agg(id ORDER BY created_at ASC NULLS LAST, id ASC))[1] AS winner_id
  FROM public.customers
  WHERE phone_norm IS NOT NULL
  GROUP BY company_id, phone_norm
  HAVING count(*) > 1
)
INSERT INTO _customer_phone_dup_map (loser_id, winner_id)
SELECT c.id AS loser_id, dg.winner_id
FROM public.customers c
JOIN dup_groups dg
  ON dg.company_id = c.company_id AND dg.phone_norm = c.phone_norm
WHERE c.id <> dg.winner_id;

-- Reasignar referencias cliente en todas las FK → public.customers(id).
DO $$
DECLARE
  fk record;
BEGIN
  FOR fk IN
    SELECT DISTINCT
      tc.table_schema AS sch,
      tc.table_name AS tbl,
      kcu.column_name AS col
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_schema = 'public'
      AND ccu.table_name = 'customers'
      AND ccu.column_name = 'id'
      AND tc.table_schema = 'public'
  LOOP
    EXECUTE format(
      $q$
      UPDATE %I.%I AS t
      SET %I = m.winner_id
      FROM _customer_phone_dup_map m
      WHERE t.%I = m.loser_id
        AND (t.%I IS DISTINCT FROM m.winner_id)
      $q$,
      fk.sch,
      fk.tbl,
      fk.col,
      fk.col,
      fk.col
    );
  END LOOP;
  RAISE NOTICE 'customer_phone_dedupe: merged % losers into winners before unique index.', (SELECT count(*) FROM _customer_phone_dup_map);
END $$;

-- Eliminar registros cliente duplicados (ya sin referencias esperables).
DELETE FROM public.customers c
USING _customer_phone_dup_map m
WHERE c.id = m.loser_id;

CREATE UNIQUE INDEX customers_company_phone_norm_uidx
  ON public.customers (company_id, phone_norm)
  WHERE phone_norm IS NOT NULL;
