-- Acelera la consulta principal del listado de chats de WhatsApp:
-- WHERE company_id = ? AND archived = false
-- ORDER BY last_message_at DESC NULLS LAST
CREATE INDEX IF NOT EXISTS whatsapp_chats_company_archived_last_message_idx
  ON public.whatsapp_chats (company_id, archived, last_message_at DESC);

-- Índice parcial adicional para el caso más frecuente (archived = false).
CREATE INDEX IF NOT EXISTS whatsapp_chats_active_last_message_idx
  ON public.whatsapp_chats (company_id, last_message_at DESC)
  WHERE archived = false;
