-- Reparar Ñ: customers tiene CORUQA / Muqoz; legacy.clientes tiene CORUÑA correcto.
-- 1) Provincias/ciudades CORUQA → valor legacy o CORUÑA
UPDATE public.customers c
SET
  address_state = CASE
    WHEN c.address_state ILIKE '%CORUQ%' THEN COALESCE(NULLIF(btrim(l.procli), ''), 'A CORUÑA')
    ELSE c.address_state
  END,
  address_city = CASE
    WHEN c.address_city ILIKE '%CORUQ%' THEN COALESCE(NULLIF(btrim(l.pobcli), ''), replace(replace(c.address_city, 'CORUQA', 'CORUÑA'), 'Coruqa', 'Coruña'))
    ELSE c.address_city
  END
FROM legacy.clientes l
WHERE c.legacy_codcli IS NOT NULL
  AND (
    btrim(c.legacy_codcli) = btrim(l.codcli)
    OR ltrim(btrim(c.legacy_codcli), '0') = ltrim(btrim(l.codcli), '0')
  )
  AND (
    c.address_state ILIKE '%CORUQ%'
    OR c.address_city ILIKE '%CORUQ%'
  );

-- Clientes sin match legacy: reemplazo literal
UPDATE public.customers
SET address_state = replace(replace(address_state, 'CORUQA', 'CORUÑA'), 'Coruqa', 'Coruña')
WHERE address_state ILIKE '%CORUQ%';

UPDATE public.customers
SET address_city = replace(replace(address_city, 'CORUQA', 'CORUÑA'), 'Coruqa', 'Coruña')
WHERE address_city ILIKE '%CORUQ%';

-- 2) Nombres: restaurar desde legacy cuando el nombre suite parece corrupción q↔ñ
UPDATE public.customers c
SET
  name = trim(both FROM concat_ws(
    ' ',
    NULLIF(btrim(l.nomcli), ''),
    NULLIF(btrim(l.ape1cli), '')
  )),
  address_street = COALESCE(NULLIF(btrim(l.dircli), ''), c.address_street),
  contact_person = COALESCE(NULLIF(btrim(l.percon), ''), c.contact_person),
  notes = COALESCE(NULLIF(btrim(l.obscli), ''), c.notes)
FROM legacy.clientes l
WHERE c.legacy_codcli IS NOT NULL
  AND (
    btrim(c.legacy_codcli) = btrim(l.codcli)
    OR ltrim(btrim(c.legacy_codcli), '0') = ltrim(btrim(l.codcli), '0')
  )
  AND NULLIF(btrim(l.nomcli), '') IS NOT NULL
  AND (
    c.name ~* '[a-záéíóú]q[aeiouáéíóú]'
    OR c.address_street ~* '[a-záéíóú]q[aeiouáéíóú]'
    OR c.contact_person ~* '[a-záéíóú]q[aeiouáéíóú]'
    OR c.notes ~* '[a-záéíóú]q[aeiouáéíóú]'
  );

-- Verificar
SELECT count(*) FILTER (WHERE address_state ILIKE '%CORUQ%') AS coruq_state,
       count(*) FILTER (WHERE address_city ILIKE '%CORUQ%') AS coruq_city,
       count(*) FILTER (WHERE name ~* '[a-záéíóú]q[aeiouáéíóú]') AS name_qish
FROM public.customers;
