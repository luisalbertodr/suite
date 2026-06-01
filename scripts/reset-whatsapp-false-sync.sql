-- Quita marca de "historial sincronizado" en chats sin mensajes en BD
-- (suele pasar tras vincular teléfono nuevo o fallos de Waha).

UPDATE public.whatsapp_chats c
SET
  history_synced_at = NULL,
  oldest_message_at = NULL,
  updated_at = now()
WHERE c.history_synced_at IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM public.whatsapp_messages m
    WHERE m.company_id = c.company_id
      AND m.chat_id = c.chat_id
  );

SELECT
  count(*) FILTER (WHERE history_synced_at IS NULL) AS chats_sin_marca_sync,
  count(*) FILTER (WHERE history_synced_at IS NOT NULL) AS chats_marcados_sync
FROM public.whatsapp_chats;
