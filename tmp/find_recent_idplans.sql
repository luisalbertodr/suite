SELECT idplan, fecha, horini, horfin, texto, nomcli, codemp
FROM dunasoft.plan2009
WHERE idplan >= 112268
ORDER BY idplan;

SELECT idplan, fecha, horini, left(coalesce(texto,''),80) as texto, nomcli
FROM dunasoft.plan2009
WHERE fecha IN ('2026-07-06','2026-07-07') AND horini >= '10:30' AND horini <= '11:00'
ORDER BY fecha, horini;
