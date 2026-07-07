-- Detalle incidencias últimos 30 min (planinc PG)
SELECT idplaninc, idplan, tipinc, fecha, horini, horfin, nomcli, fechorinc
FROM dunasoft.planinc
WHERE fechorinc > now() - interval '30 minutes'
ORDER BY fechorinc DESC;

-- plan2009 vs planinc recientes
SELECT p.idplan, p.horini AS pg_horini, p.horfin AS pg_horfin, p.nomcli,
       i.tipinc, i.horini AS inc_horini, i.horfin AS inc_horfin, i.fechorinc
FROM dunasoft.planinc i
LEFT JOIN dunasoft.plan2009 p ON p.idplan = i.idplan
WHERE i.fechorinc > now() - interval '30 minutes'
ORDER BY i.fechorinc DESC;

-- Huellas idplans recientes
SELECT style_key, fingerprint, updated_at
FROM dunasoft.style_sync_dbf_fingerprint
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND tabla = 'plan2009'
  AND style_key IN ('112220','112221','1000000000','1000000001','1000000002')
ORDER BY style_key;
