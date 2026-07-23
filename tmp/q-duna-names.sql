\d dunasoft.clientes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema='dunasoft' AND table_name='clientes'
ORDER BY ordinal_position;

SELECT count(*) AS n FROM dunasoft.clientes;
SELECT codcli, nomcli, ape1cli, pais
FROM dunasoft.clientes
WHERE nomcli ILIKE '%Ã%'
   OR nomcli ILIKE '%C1%'
   OR ape1cli ILIKE '%Ã%'
   OR pais ILIKE '%C1%'
   OR pais ILIKE '%Ã%'
LIMIT 20;

SELECT codcli, nomcli, ape1cli, pais
FROM dunasoft.clientes
WHERE nomcli ~ '\s' AND (ape1cli IS NULL OR btrim(ape1cli)='')
LIMIT 15;

SELECT count(*) FILTER (WHERE nomcli ILIKE '%Ã%') AS mojibake_nom,
       count(*) FILTER (WHERE pais ILIKE '%C1%' OR pais ILIKE '%Ã%') AS bad_pais,
       count(*) FILTER (WHERE nomcli ~ '\s' AND coalesce(btrim(ape1cli),'')='') AS name_in_nom_empty_ape
FROM dunasoft.clientes;
