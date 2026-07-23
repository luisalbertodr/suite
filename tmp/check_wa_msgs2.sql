-- Mensajes más recientes (timestamp es timestamptz)
SELECT left(coalesce(body,''),60) AS body, type, from_me, chat_id,
       timestamp, created_at
FROM whatsapp_messages
ORDER BY timestamp DESC NULLS LAST
LIMIT 15;

-- Chats con actividad reciente sin last_message_at
SELECT id, name, chat_jid, last_message_at, updated_at, unread_count
FROM whatsapp_chats
WHERE updated_at > now() - interval '15 minutes'
ORDER BY updated_at DESC;

-- Beatriz Perez
SELECT c.name, m.body, m.type, m.from_me, m.timestamp, m.created_at
FROM whatsapp_chats c
LEFT JOIN whatsapp_messages m ON m.chat_id = c.id
WHERE c.name ILIKE '%Beatriz Perez%'
ORDER BY m.timestamp DESC NULLS LAST
LIMIT 10;

SELECT company_id, webhook_secret IS NOT NULL AS has_secret,
       left(coalesce(webhook_secret,''),8) AS secret_prefix,
       last_status, last_status_at
FROM whatsapp_config;
