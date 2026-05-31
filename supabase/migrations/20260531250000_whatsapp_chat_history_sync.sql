-- Marca qué chats ya tienen el historial completo importado desde Waha.
-- history_synced_at: cuándo terminó la última sync completa.
-- oldest_message_at: timestamp del mensaje más antiguo guardado en BD.

ALTER TABLE public.whatsapp_chats
  ADD COLUMN IF NOT EXISTS history_synced_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS oldest_message_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS whatsapp_chats_company_unsynced_idx
  ON public.whatsapp_chats (company_id, last_message_at DESC NULLS LAST)
  WHERE history_synced_at IS NULL AND archived = false;

-- Chats que ya tienen mensajes en BD se consideran sincronizados (evita re-import masivo).
UPDATE public.whatsapp_chats c
SET
  history_synced_at = COALESCE(c.history_synced_at, now()),
  oldest_message_at = sub.min_ts
FROM (
  SELECT company_id, chat_id, MIN(timestamp) AS min_ts
  FROM public.whatsapp_messages
  GROUP BY company_id, chat_id
) sub
WHERE c.company_id = sub.company_id
  AND c.chat_id = sub.chat_id
  AND c.history_synced_at IS NULL;
