-- Datos: reparar encoding Suite + rellenar dunasoft.clientes (nom/ape) y forzar push Style.
-- Ejecutar DESPUÉS de 20260722160000_split_customer_name_style_sync.sql

BEGIN;

-- Evitar que el trigger encole dos veces durante el UPDATE de reparación
SELECT set_config('dunasoft.in_style_apply', '1', true);

-- 1) Suite: encoding en campos de texto
UPDATE public.customers c
SET
  name = public.repair_customer_text(c.name),
  address_street = public.repair_customer_text(c.address_street),
  address_city = public.repair_customer_text(c.address_city),
  address_state = public.repair_customer_text(c.address_state),
  address_country = CASE
    WHEN public.repair_customer_text(c.address_country) ~* '^espa' THEN 'España'
    ELSE coalesce(nullif(public.repair_customer_text(c.address_country), ''), c.address_country)
  END,
  contact_person = public.repair_customer_text(c.contact_person),
  notes = public.repair_customer_text(c.notes),
  updated_at = now()
WHERE c.name IS DISTINCT FROM public.repair_customer_text(c.name)
   OR c.address_street IS DISTINCT FROM public.repair_customer_text(c.address_street)
   OR c.address_city IS DISTINCT FROM public.repair_customer_text(c.address_city)
   OR c.address_state IS DISTINCT FROM public.repair_customer_text(c.address_state)
   OR c.address_country IS DISTINCT FROM public.repair_customer_text(c.address_country)
   OR c.contact_person IS DISTINCT FROM public.repair_customer_text(c.contact_person)
   OR c.notes IS DISTINCT FROM public.repair_customer_text(c.notes);

-- 2) Suite: restaurar nombre completo desde legacy cuando Suite está truncado/placeholder
UPDATE public.customers c
SET
  name = public.repair_customer_text(
    trim(both FROM concat_ws(' ', nullif(btrim(l.nomcli), ''), nullif(btrim(l.ape1cli), '')))
  ),
  updated_at = now()
FROM legacy.clientes l
WHERE (
    btrim(c.legacy_codcli) = btrim(l.codcli)
    OR ltrim(btrim(c.legacy_codcli), '0') = ltrim(btrim(l.codcli), '0')
  )
  AND nullif(btrim(l.nomcli), '') IS NOT NULL
  AND (
    c.name IS NULL
    OR btrim(c.name) = ''
    OR c.name ~* '^Cliente\s+[0-9]+$'
    OR (
      length(btrim(c.name)) < length(trim(both FROM concat_ws(' ', nullif(btrim(l.nomcli), ''), nullif(btrim(l.ape1cli), ''))))
      AND lower(btrim(c.name)) = lower(btrim(l.nomcli))
      AND nullif(btrim(l.ape1cli), '') IS NOT NULL
    )
  );

-- 3) Dunasoft: restaurar nomcli/ape1cli desde legacy (fuente con split correcto)
UPDATE dunasoft.clientes d
SET
  nomcli = public.repair_customer_text(l.nomcli),
  ape1cli = public.repair_customer_text(l.ape1cli),
  pobcli = coalesce(public.repair_customer_text(l.pobcli), d.pobcli),
  procli = coalesce(public.repair_customer_text(l.procli), d.procli),
  pais = CASE
    WHEN public.repair_customer_text(coalesce(l.pais, d.pais)) ~* '^espa' THEN 'España'
    ELSE coalesce(nullif(public.repair_customer_text(l.pais), ''), public.repair_customer_text(d.pais), d.pais)
  END,
  dircli = coalesce(public.repair_customer_text(l.dircli), d.dircli),
  percon = coalesce(public.repair_customer_text(l.percon), d.percon),
  obscli = coalesce(public.repair_customer_text(l.obscli), d.obscli)
FROM legacy.clientes l
WHERE btrim(d.codcli) = btrim(l.codcli)
  AND (
    d.nomcli IS DISTINCT FROM public.repair_customer_text(l.nomcli)
    OR coalesce(d.ape1cli, '') IS DISTINCT FROM coalesce(public.repair_customer_text(l.ape1cli), '')
    OR coalesce(d.pais, '') ILIKE '%C1%'
    OR coalesce(d.pais, '') LIKE '%Ã%'
  );

-- 4) Dunasoft sin legacy usable: split heurístico del nombre actual (o Suite)
UPDATE dunasoft.clientes d
SET
  nomcli = s.nomcli,
  ape1cli = s.ape1cli
FROM (
  SELECT
    d2._row_id,
    sp.nomcli,
    sp.ape1cli
  FROM dunasoft.clientes d2
  LEFT JOIN legacy.clientes l ON btrim(l.codcli) = btrim(d2.codcli)
  CROSS JOIN LATERAL public.split_customer_display_name(
    CASE
      WHEN coalesce(btrim(d2.ape1cli), '') = '' AND d2.nomcli ~ '\s'
        THEN d2.nomcli
      WHEN coalesce(btrim(l.ape1cli), '') = '' AND coalesce(btrim(l.nomcli), '') ~ '\s'
        THEN l.nomcli
      ELSE NULL
    END
  ) sp
  WHERE sp.nomcli IS NOT NULL
    AND coalesce(btrim(d2.ape1cli), '') = ''
    AND d2.nomcli ~ '\s'
    AND d2.nomcli !~* '\y(s\.?\s*l\.?|s\.?\s*a\.?|sociedad)\y'
) s
WHERE d._row_id = s._row_id;

-- 5) Encolar Suite→Style con nom/ape ya separados (corrige DBF Style/Dunasoft UI)
SELECT set_config('dunasoft.in_style_apply', '0', true);

INSERT INTO dunasoft.style_sync_outbox (
  company_id, entity_type, operation, style_key, suite_id, payload
)
SELECT
  c.company_id,
  'customer',
  'update',
  c.legacy_codcli,
  c.id,
  jsonb_build_object(
    'codcli', c.legacy_codcli,
    'nomcli', coalesce(sp.nomcli, ''),
    'ape1cli', coalesce(sp.ape1cli, ''),
    'tel1cli', coalesce(c.phone_home, c.phone, ''),
    'tel2cli', coalesce(c.phone_mobile, ''),
    'email', coalesce(c.email, ''),
    'dnicli', coalesce(c.tax_id, ''),
    'dircli', coalesce(public.repair_customer_text(c.address_street), ''),
    'codposcli', coalesce(c.address_postal_code, ''),
    'pobcli', coalesce(public.repair_customer_text(c.address_city), ''),
    'procli', coalesce(public.repair_customer_text(c.address_state), ''),
    'pais', coalesce(public.repair_customer_text(c.address_country), ''),
    'percon', coalesce(public.repair_customer_text(c.contact_person), ''),
    'obscli', coalesce(public.repair_customer_text(c.notes), ''),
    'fecnac', coalesce(to_char(c.birth_date, 'YYYY-MM-DD'), '')
  )
FROM public.customers c
CROSS JOIN LATERAL public.split_customer_display_name(c.name) sp
WHERE c.company_id IS NOT NULL
  AND c.legacy_codcli IS NOT NULL
  AND btrim(c.legacy_codcli) <> ''
  AND btrim(c.legacy_codcli) <> '0'
  AND nullif(btrim(c.name), '') IS NOT NULL
  AND dunasoft.suite_to_style_enabled('clientes')
  AND NOT EXISTS (
    SELECT 1
    FROM dunasoft.style_sync_outbox o
    WHERE o.company_id = c.company_id
      AND o.entity_type = 'customer'
      AND o.style_key = c.legacy_codcli
      AND o.delivered_at IS NULL
      AND o.created_at > now() - interval '1 hour'
  );

COMMIT;

-- Verificación
SELECT 'suite_espac1' AS k, count(*) FROM public.customers WHERE address_country ILIKE '%C1%';
SELECT 'duna_sample' AS k, codcli, nomcli, ape1cli, pais
FROM dunasoft.clientes
WHERE codcli IN ('000330','004428','002950')
ORDER BY codcli;

SELECT 'outbox_pending' AS k, count(*)
FROM dunasoft.style_sync_outbox
WHERE entity_type = 'customer' AND delivered_at IS NULL;
