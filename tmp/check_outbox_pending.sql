SELECT entity_type, company_id::text, count(*) AS n,
       min(created_at) AS oldest, max(created_at) AS newest,
       count(*) FILTER (WHERE payload->>'suite_company_id' IS NULL) AS sin_origen
FROM dunasoft.style_sync_outbox
WHERE delivered_at IS NULL
GROUP BY 1, 2
ORDER BY n DESC;

SELECT id, entity_type, company_id::text,
       payload->>'suite_company_id' AS origen,
       payload->>'fecha' AS fecha,
       left(payload::text, 120) AS payload_preview
FROM dunasoft.style_sync_outbox
WHERE delivered_at IS NULL
ORDER BY created_at DESC
LIMIT 5;

SELECT company_id::text, sync_enabled, macand
FROM public.style_reservas_sync_config
ORDER BY company_id;

SELECT tabla, enabled FROM dunasoft.style_sync_cursor
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
ORDER BY tabla;
