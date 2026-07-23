-- Remaining "qish" — ¿falsos positivos (Joaquín) o corrupción real?
SELECT name, legacy_codcli
FROM public.customers
WHERE name ~* '[a-záéíóú]q[aeiouáéíóú]'
ORDER BY name
LIMIT 40;

SELECT c.name AS suite_name,
       trim(both FROM concat_ws(' ', nullif(btrim(l.nomcli),''), nullif(btrim(l.ape1cli),''))) AS legacy_name
FROM public.customers c
JOIN legacy.clientes l ON (
  btrim(c.legacy_codcli) = btrim(l.codcli)
  OR ltrim(btrim(c.legacy_codcli), '0') = ltrim(btrim(l.codcli), '0')
)
WHERE c.name ~* '[a-záéíóú]q[aeiouáéíóú]'
  AND c.name IS DISTINCT FROM trim(both FROM concat_ws(' ', nullif(btrim(l.nomcli),''), nullif(btrim(l.ape1cli),'')))
LIMIT 25;

SELECT address_state, count(*) FROM public.customers
WHERE address_state ILIKE '%CORU%'
GROUP BY 1 ORDER BY 2 DESC LIMIT 10;
