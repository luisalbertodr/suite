-- Purga cola outbox generada el 2026-06-29 al activar triggers (backfill histórico).
-- No debe reinyectarse en Style: incluye cierres de 2012, clientes masivos, etc.
-- Los nuevos encolados tras el hub incluyen payload.suite_company_id.

UPDATE dunasoft.style_sync_outbox
SET
  delivered_at = now(),
  error = 'skipped_pre_hub_backlog',
  attempts = coalesce(attempts, 0) + 1
WHERE delivered_at IS NULL
  AND created_at < '2026-07-01'::timestamptz;

COMMENT ON TABLE dunasoft.style_sync_outbox IS
  'Cola Suite→Style. company_id = hub Style. payload.suite_company_id = empresa Suite origen (desde hub migration 202607041300).';
