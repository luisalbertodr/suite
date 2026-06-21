-- Lag de sincronizacion (ms) para detectar degradacion antes de alertas stopped.

ALTER TABLE dunasoft.style_sync_agent_state
  ADD COLUMN IF NOT EXISTS last_outbound_lag_ms bigint,
  ADD COLUMN IF NOT EXISTS last_inbound_lag_ms bigint;

COMMENT ON COLUMN dunasoft.style_sync_agent_state.last_outbound_lag_ms IS
  'NOW() - cola_sincro.creado del ultimo outbound OK (ms)';
COMMENT ON COLUMN dunasoft.style_sync_agent_state.last_inbound_lag_ms IS
  'NOW() - style_reservas_queue.created_at del ultimo inbound ACK OK (ms)';
