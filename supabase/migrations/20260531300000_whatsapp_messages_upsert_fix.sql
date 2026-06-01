-- PostgREST/Supabase upsert requiere un índice UNIQUE sin predicado WHERE.
-- El índice parcial (WHERE waha_message_id IS NOT NULL) provocaba error 42P10
-- y los mensajes nunca se guardaban (el proxy ignoraba el error).

DROP INDEX IF EXISTS public.whatsapp_messages_company_waha_id_uidx;

CREATE UNIQUE INDEX whatsapp_messages_company_waha_id_uidx
  ON public.whatsapp_messages (company_id, waha_message_id);

-- Permitir reimportar historial en chats marcados como sincronizados sin filas.
UPDATE public.whatsapp_chats c
SET
  history_synced_at = NULL,
  oldest_message_at = NULL
WHERE NOT EXISTS (
  SELECT 1
  FROM public.whatsapp_messages m
  WHERE m.company_id = c.company_id
    AND m.chat_id = c.chat_id
);
