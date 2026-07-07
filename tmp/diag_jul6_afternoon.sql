-- Eventos planinc hoy tarde (idplans prueba + Luis)
SELECT idplaninc, idplan, tipinc, fecha, horini, horfin, nomcli, codemp, fechorinc
FROM dunasoft.planinc
WHERE fechorinc >= '2026-07-06 16:00:00+00'
ORDER BY fechorinc;

-- plan2009 actual esos idplans
SELECT idplan, codemp, fecha, horini, horfin, nomcli FROM dunasoft.plan2009
WHERE idplan IN (112220, 112221, 112222, 112223);

-- control_sincro si existe en PG
SELECT * FROM dunasoft.control_sincro LIMIT 1;
