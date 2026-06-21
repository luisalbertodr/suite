-- Marketing leads: realtime para refrescar el tablero al insertar/actualizar (meta-sync, etc.)
-- El filtro postgres_changes por company_id requiere REPLICA IDENTITY FULL.

ALTER TABLE public.marketing_leads REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.marketing_leads;
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END IF;
END $$;
