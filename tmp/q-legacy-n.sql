SELECT procli, count(*) FROM legacy.clientes
WHERE procli ILIKE '%CORU%' OR procli ILIKE '%oru%'
GROUP BY 1 ORDER BY 2 DESC LIMIT 20;

SELECT encode(convert_to(procli, 'UTF8'), 'hex'), procli
FROM legacy.clientes
WHERE procli ILIKE '%CORU%'
LIMIT 5;

SELECT nomcli FROM legacy.clientes
WHERE nomcli ILIKE '%Mu%oz%' OR nomcli ILIKE '%Muqoz%' OR nomcli ILIKE '%Vilari%'
LIMIT 20;
