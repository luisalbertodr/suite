-- Consultas de listado por chat (sin raw): índice alineado con ORDER BY timestamp DESC + LIMIT.

CREATE INDEX IF NOT EXISTS whatsapp_messages_company_chat_time_desc_idx
  ON public.whatsapp_messages (company_id, chat_id, timestamp DESC);
