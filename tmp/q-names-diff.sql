-- Comparar dunasoft vs legacy: nombre unido
SELECT count(*) AS total_duna,
       count(*) FILTER (WHERE d.nomcli IS DISTINCT FROM l.nomcli OR coalesce(d.ape1cli,'') IS DISTINCT FROM coalesce(l.ape1cli,'')) AS differ,
       count(*) FILTER (WHERE position(coalesce(l.ape1cli,'') in coalesce(d.nomcli,'')) > 0 AND coalesce(btrim(l.ape1cli),'')<>'' AND coalesce(btrim(d.ape1cli),'')='') AS ape_moved_into_nom,
       count(*) FILTER (WHERE d.pais ILIKE '%C1%' OR d.pais LIKE '%Ã%' OR d.pais ILIKE 'Espa%a' AND d.pais !~* 'españa') AS bad_pais_duna
FROM dunasoft.clientes d
JOIN legacy.clientes l ON btrim(l.codcli)=btrim(d.codcli);

SELECT d.codcli, d.nomcli AS d_nom, d.ape1cli AS d_ape, l.nomcli AS l_nom, l.ape1cli AS l_ape, d.pais
FROM dunasoft.clientes d
JOIN legacy.clientes l ON btrim(l.codcli)=btrim(d.codcli)
WHERE d.nomcli IS DISTINCT FROM l.nomcli
   OR coalesce(d.ape1cli,'') IS DISTINCT FROM coalesce(l.ape1cli,'')
LIMIT 40;

SELECT encode(convert_to(address_country, 'UTF8'), 'hex'), address_country, name
FROM public.customers WHERE address_country ILIKE '%C1%' OR address_country NOT ILIKE 'españa' AND address_country ILIKE 'espa%'
LIMIT 20;

SELECT encode(convert_to(pais, 'UTF8'), 'hex'), pais, count(*)
FROM dunasoft.clientes
WHERE pais IS NOT NULL AND btrim(pais)<>''
GROUP BY 1,2
ORDER BY 3 DESC
LIMIT 20;

-- ¿Suite name = nom+ape legacy?
SELECT count(*) AS suite_diff_from_legacy_full
FROM public.customers c
JOIN legacy.clientes l ON c.legacy_codcli = l.codcli OR ltrim(c.legacy_codcli,'0') = ltrim(l.codcli,'0')
WHERE c.name IS DISTINCT FROM trim(both FROM concat_ws(' ', nullif(btrim(l.nomcli),''), nullif(btrim(l.ape1cli),'')));
