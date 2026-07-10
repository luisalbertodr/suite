\pset format aligned

\echo '=== Cursors faccab / ciecab ==='
SELECT tabla, enabled, last_id, last_ok_at, last_error, pending, errors
FROM dunasoft.style_sync_cursor
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND tabla IN ('faccab', 'ciecab', 'albcab')
ORDER BY tabla;

\echo '=== Agent state ==='
SELECT agent_last_tick_at, last_cola_id, last_error, plan2009_poll
FROM dunasoft.style_sync_agent_state
LIMIT 1;

\echo '=== Checkpoints billing ==='
SELECT checkpoint_key, applied_at
FROM dunasoft.style_sync_billing_checkpoints
WHERE company_id = dunasoft.style_sync_hub_company_id()
ORDER BY applied_at DESC;
