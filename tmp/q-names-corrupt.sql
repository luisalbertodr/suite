-- Suite: mojibake y pais raro
SELECT count(*) FILTER (WHERE name LIKE '%Ã%') AS mojibake_name,
       count(*) FILTER (WHERE name LIKE '%Â%') AS mojibake_name2,
       count(*) FILTER (WHERE address_country ILIKE '%C1%' OR address_country LIKE '%Ã%') AS bad_country,
       count(*) FILTER (WHERE name ~* 'RACAS|RAÃ') AS racasish,
       count(*) FILTER (WHERE name LIKE '%' || CHR(65533) || '%') AS replacement
FROM public.customers;

SELECT id::text, legacy_codcli, name, address_country, address_state
FROM public.customers
WHERE name LIKE '%Ã%'
   OR name LIKE '%Â%'
   OR address_country ILIKE '%C1%'
   OR address_country LIKE '%Ã%'
   OR name ILIKE '%RACAS%'
LIMIT 30;

-- Dunasoft vs legacy vs suite para mismos codigos
SELECT d.codcli,
       d.nomcli AS d_nom, d.ape1cli AS d_ape, d.pais AS d_pais,
       l.nomcli AS l_nom, l.ape1cli AS l_ape, l.pais AS l_pais,
       c.name AS s_name, c.address_country AS s_pais
FROM dunasoft.clientes d
LEFT JOIN legacy.clientes l ON btrim(l.codcli) = btrim(d.codcli)
LEFT JOIN public.customers c ON c.legacy_codcli = d.codcli
WHERE d.nomcli ~ '\s{1,}' AND coalesce(btrim(d.ape1cli),'') = ''
   OR d.nomcli LIKE '%Ã%'
   OR d.pais LIKE '%Ã%'
   OR d.pais ILIKE '%C1%'
LIMIT 25;

-- ¿Cuántos dunasoft tienen nombre completo en nomcli y ape vacío, pero legacy sí tiene ape?
SELECT count(*) AS merged_but_legacy_split
FROM dunasoft.clientes d
JOIN legacy.clientes l ON btrim(l.codcli) = btrim(d.codcli)
WHERE coalesce(btrim(d.ape1cli),'') = ''
  AND d.nomcli ~ '\s'
  AND coalesce(btrim(l.ape1cli),'') <> '';

SELECT count(*) AS duna_full_name_empty_ape FROM dunasoft.clientes
WHERE coalesce(btrim(ape1cli),'') = '' AND nomcli ~ '\s';
