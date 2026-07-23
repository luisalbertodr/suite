SELECT d.codcli,
       left(d.nomcli,40) AS d_nom, left(d.ape1cli,40) AS d_ape,
       left(l.nomcli,40) AS l_nom, left(l.ape1cli,40) AS l_ape
FROM dunasoft.clientes d
JOIN legacy.clientes l ON btrim(l.codcli)=btrim(d.codcli)
WHERE (coalesce(btrim(d.nomcli),'') <> '' OR coalesce(btrim(l.nomcli),'') <> '')
  AND (
    d.nomcli IS DISTINCT FROM l.nomcli
    OR coalesce(d.ape1cli,'') IS DISTINCT FROM coalesce(l.ape1cli,'')
  )
LIMIT 40;

-- Suite names that differ from legacy full name (non-empty)
SELECT c.legacy_codcli, c.name AS suite_name,
       trim(both FROM concat_ws(' ', nullif(btrim(l.nomcli),''), nullif(btrim(l.ape1cli),''))) AS legacy_full,
       l.nomcli, l.ape1cli, c.address_country
FROM public.customers c
JOIN legacy.clientes l ON c.legacy_codcli = l.codcli
   OR (ltrim(coalesce(c.legacy_codcli,''),'0') = ltrim(l.codcli,'0') AND coalesce(c.legacy_codcli,'') <> '')
WHERE c.name IS DISTINCT FROM trim(both FROM concat_ws(' ', nullif(btrim(l.nomcli),''), nullif(btrim(l.ape1cli),'')))
  AND coalesce(btrim(c.name),'') <> ''
LIMIT 40;

SELECT count(*) FILTER (WHERE address_country ILIKE '%C1%' OR address_country ~ 'Espa[^ñÑ]a') AS bad_es,
       count(*) FILTER (WHERE name LIKE '%Ã%' OR name LIKE '%Â%') AS mojibake
FROM public.customers;

-- Outbox pending clientes
SELECT count(*) FROM dunasoft.style_sync_outbox WHERE entity_type='customer' AND status IN ('pending','error');
