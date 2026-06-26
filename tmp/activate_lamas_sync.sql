-- Activación sync Style ↔ Suite: Mar Lamas host + SL sin duplicar maestros
UPDATE dunasoft.style_sync_cursor
SET enabled = true, last_error = NULL, updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND tabla IN ('clientes', 'articulos', 'bonoscli', 'ciecab');

UPDATE dunasoft.style_sync_cursor
SET enabled = false, updated_at = now()
WHERE company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d';

SELECT c.name, sc.tabla, sc.enabled
FROM dunasoft.style_sync_cursor sc
JOIN public.companies c ON c.id = sc.company_id
WHERE sc.company_id IN (
  '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4',
  '816af484-92a0-4f65-a5a7-1c907aa4bb3d'
)
ORDER BY c.name, sc.tabla;
