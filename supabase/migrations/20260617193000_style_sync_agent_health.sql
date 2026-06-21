-- Salud del worker inbound VFP y alertas desde el agente Node.

ALTER TABLE dunasoft.style_sync_agent_state
  ADD COLUMN IF NOT EXISTS inbound_worker_last_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS inbound_worker_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS inbound_worker_alert_at timestamptz,
  ADD COLUMN IF NOT EXISTS inbound_worker_alert_message text,
  ADD COLUMN IF NOT EXISTS agent_last_tick_at timestamptz;

COMMENT ON COLUMN dunasoft.style_sync_agent_state.inbound_worker_status IS
  'ok | stopped | unknown — actualizado por style-sync-agent según heartbeat.txt';
