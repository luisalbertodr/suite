SELECT idplan, fecha::text, horini, horfin, nomcli
FROM dunasoft.plan2009
WHERE idplan::text LIKE '100000000%' OR idplan IN (112222, 112228)
ORDER BY idplan;
