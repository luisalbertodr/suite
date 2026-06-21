-- Métricas operativas del agente Node (monitorización Suite / ops).

ALTER TABLE dunasoft.style_sync_agent_state
  ADD COLUMN IF NOT EXISTS last_outbound_ok_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_inbound_ok_at timestamptz,
  ADD COLUMN IF NOT EXISTS outbound_errors bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS inbound_errors bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agent_version text,
  ADD COLUMN IF NOT EXISTS worker_version text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS last_error_at timestamptz;

COMMENT ON COLUMN dunasoft.style_sync_agent_state.last_outbound_ok_at IS
  'Último RPC style_reservas_apply_from_style exitoso';
COMMENT ON COLUMN dunasoft.style_sync_agent_state.last_inbound_ok_at IS
  'Último RPC style_reservas_ack exitoso';
