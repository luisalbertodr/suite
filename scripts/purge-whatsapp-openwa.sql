-- Borra mensajes OpenWA de todas las empresas (conserva WAHA).
-- Requiere migración 20260621200000_whatsapp_purge_openwa.sql aplicada.

DO $purge$
DECLARE
  r record;
  res jsonb;
BEGIN
  FOR r IN SELECT id FROM public.companies ORDER BY name
  LOOP
    res := public.whatsapp_purge_openwa_data_internal(r.id);
    RAISE NOTICE 'company %: %', r.id, res::text;
  END LOOP;
END $purge$;

SELECT
  count(*) FILTER (
    WHERE public.whatsapp_message_is_openwa(raw, source_provider)
  ) AS openwa_messages_remaining,
  count(*) AS total_messages
FROM public.whatsapp_messages;
