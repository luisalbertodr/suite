SELECT version FROM supabase_migrations.schema_migrations WHERE version LIKE '%style_sync%' ORDER BY version DESC LIMIT 3;
SELECT last_cola_id, agent_version, last_error FROM dunasoft.style_sync_agent_state WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
UPDATE dunasoft.style_sync_agent_state SET last_cola_id = 0, last_error = NULL, updated_at = now() WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
SELECT last_cola_id FROM dunasoft.style_sync_agent_state WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
