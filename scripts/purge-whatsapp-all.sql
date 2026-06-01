-- Limpieza total del historial WhatsApp en la suite (todas las empresas).
-- Ejecutar antes de vincular un teléfono nuevo en Waha.

DELETE FROM public.whatsapp_messages;
DELETE FROM public.whatsapp_chats;

UPDATE public.whatsapp_config
SET
  last_status = 'STOPPED',
  last_status_message = NULL,
  last_status_at = now(),
  qr_data_url = NULL,
  qr_updated_at = NULL,
  me_jid = NULL,
  me_pushname = NULL,
  updated_at = now();

SELECT
  (SELECT count(*) FROM public.whatsapp_messages) AS messages_remaining,
  (SELECT count(*) FROM public.whatsapp_chats) AS chats_remaining;
