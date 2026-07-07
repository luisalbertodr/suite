SELECT company_id, last_cola_id, last_outbound_ok_at, last_error, agent_version
FROM dunasoft.style_sync_agent_state;

SELECT prosrc LIKE '%legacy_idplan = p_idplan%' AS has_global_lookup,
       prosrc LIKE '%company_id = p_company_id AND a.legacy_idplan%' AS has_company_only_lookup
FROM pg_proc
WHERE proname = 'style_reservas_apply_from_style'
  AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'dunasoft');
