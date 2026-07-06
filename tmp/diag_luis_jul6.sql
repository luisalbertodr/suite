-- Cita Luis Alberto Díaz, 6 jul 2026
SELECT p.idplan, p.nomcli, p.fecha, p.horini, p.horfin, p.codemp, p.codcli, p.texto
FROM dunasoft.plan2009 p
WHERE p.fecha = '2026-07-06'
  AND p.nomcli ILIKE '%Luis%Alberto%'
ORDER BY p.horini;

SELECT f.style_key, f.fingerprint, f.updated_at
FROM dunasoft.style_sync_dbf_fingerprint f
WHERE f.tabla = 'plan2009'
  AND f.style_key IN (
    SELECT trim(leading '0' from idplan::text)
    FROM dunasoft.plan2009
    WHERE fecha = '2026-07-06' AND nomcli ILIKE '%Luis%Alberto%'
  );

SELECT id, idplan, operation, delivered_at IS NULL AS pending, error, created_at
FROM dunasoft.style_reservas_queue
WHERE idplan IN (
  SELECT idplan FROM dunasoft.plan2009
  WHERE fecha = '2026-07-06' AND nomcli ILIKE '%Luis%Alberto%'
)
ORDER BY id DESC LIMIT 10;

SELECT * FROM dunasoft.style_sync_agent_status();
