-- Fase A: salud pipeline
SELECT 'agent_state' AS section, row_to_json(s)::text
FROM dunasoft.style_sync_agent_state s
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT 'agent_status' AS section, public.style_sync_agent_status('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4')::text;

SELECT 'cursors' AS section, tabla, enabled, dbf_baseline_seeded, last_id, left(coalesce(last_error,''),80) AS last_error
FROM dunasoft.style_sync_cursor
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
ORDER BY tabla;

SELECT 'inbound_pending' AS section, count(*)::text AS val
FROM dunasoft.style_reservas_queue
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND delivered_at IS NULL;

SELECT 'outbox_pending' AS section, count(*)::text AS val
FROM dunasoft.style_sync_outbox
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND delivered_at IS NULL;

-- Fase B: conteos drift
SELECT 'entity_map' AS section, entity_type, count(*) AS mapped
FROM dunasoft.style_sync_entity_map
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
GROUP BY entity_type ORDER BY entity_type;

SELECT 'fingerprints' AS section, tabla, count(*) AS huellas, max(updated_at) AS last_fp_update
FROM dunasoft.style_sync_dbf_fingerprint
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
GROUP BY tabla ORDER BY tabla;

SELECT 'suite_counts' AS section, kind, total FROM (
  SELECT 'customers' AS kind, count(*)::bigint AS total FROM public.customers WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  UNION ALL SELECT 'articles', count(*) FROM public.articles WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  UNION ALL SELECT 'vouchers', count(*) FROM public.customer_vouchers WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  UNION ALL SELECT 'sales', count(*) FROM public.sales WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  UNION ALL SELECT 'invoices', count(*) FROM public.invoices WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  UNION ALL SELECT 'cash_sessions', count(*) FROM public.cash_sessions WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  UNION ALL SELECT 'plan2009', count(*) FROM dunasoft.plan2009 WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
) x ORDER BY kind;

-- Citas recientes en Suite (últimos 3 días)
SELECT 'plan2009_recent' AS section, fecha::text, count(*) AS citas
FROM dunasoft.plan2009
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND fecha >= current_date - 2
GROUP BY fecha ORDER BY fecha;

-- planinc reciente (cambios Style)
SELECT 'planinc_recent' AS section, count(*)::text AS incidencias_24h
FROM dunasoft.planinc
WHERE fechorinc > now() - interval '24 hours';

SELECT 'baseline_audit' AS section, row_to_json(b)::text
FROM public.style_sync_baseline_audit('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4') b;
