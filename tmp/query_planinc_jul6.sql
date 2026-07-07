SELECT tipinc, idplan, horini, horinix, left(nomcli, 30) AS nomcli, fechorinc
FROM dunasoft.planinc
WHERE fecha = '2026-07-06'
  AND horini >= '10:00'
  AND horini < '14:00'
  AND fechorinc >= now() - interval '4 hours'
ORDER BY fechorinc DESC
LIMIT 20;
