SELECT count(*) AS plan2009_suite FROM dunasoft.plan2009;
SELECT fecha::text, count(*) AS citas FROM dunasoft.plan2009 WHERE fecha >= current_date - 3 GROUP BY fecha ORDER BY fecha;
SELECT count(*) AS fp_plan2009 FROM dunasoft.style_sync_dbf_fingerprint WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND tabla='plan2009';
SELECT idplaninc, idplan, tipinc, fecha::text, horini, horfin, nomcli, fechorinc FROM dunasoft.planinc WHERE fechorinc > now() - interval '48 hours' ORDER BY fechorinc DESC LIMIT 20;
