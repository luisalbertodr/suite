SELECT last_cola_id, outbound_errors, left(coalesce(last_error,''),100) AS last_error, agent_last_tick_at, inbound_worker_status, inbound_worker_last_seen_at
FROM dunasoft.style_sync_agent_state
WHERE company_id='5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
