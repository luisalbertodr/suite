-- Citas plan2009 Suite 6 jul 2026 10:00-14:00
SELECT idplan, codemp, codcli, fecha, horini, horfin, nomcli, texto, facturado
FROM dunasoft.plan2009
WHERE fecha = '2026-07-06'
  AND horini >= '10:00'
  AND horini < '14:00'
ORDER BY horini, idplan;

-- agenda_appointments mismo rango
SELECT id, legacy_idplan, employee_id, client_name, start_time, end_time, status, updated_at
FROM public.agenda_appointments
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND start_time >= '2026-07-06T10:00:00'
  AND start_time < '2026-07-06T14:00:00'
ORDER BY start_time;

-- planinc reciente (últimas incidencias)
SELECT idplaninc, idplan, tipinc, fecha, horini, horfin, nomcli, fechorinc
FROM dunasoft.planinc
WHERE fecha = '2026-07-06'
  AND horini >= '10:00'
  AND horini < '14:00'
ORDER BY fechorinc DESC NULLS LAST, idplaninc DESC
LIMIT 40;

-- Estado agente sync
SELECT last_cola_id, last_outbound_ok_at, last_inbound_ok_at, outbound_errors, inbound_errors,
       last_error, last_error_at, agent_last_tick_at, agent_version, inbound_worker_status
FROM dunasoft.style_sync_agent_state
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

-- Cola pendiente reciente (si hay tabla espejo o logs)
-- Fingerprints huellas para idplans del día
SELECT style_key, fingerprint, updated_at
FROM dunasoft.style_sync_dbf_fingerprint
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND tabla = 'plan2009'
ORDER BY updated_at DESC
LIMIT 30;
