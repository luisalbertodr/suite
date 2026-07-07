-- Realtime para colas Style↔Suite: el agente reacciona a INSERT sin poll periódico.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'dunasoft'
        AND tablename = 'style_reservas_queue'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE dunasoft.style_reservas_queue;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'dunasoft'
        AND tablename = 'style_sync_outbox'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE dunasoft.style_sync_outbox;
    END IF;
  END IF;
END $$;
