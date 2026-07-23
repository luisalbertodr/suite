SELECT column_name FROM information_schema.columns
WHERE table_name = 'whatsapp_chats' ORDER BY ordinal_position;

SELECT c.name, c.chat_id, c.last_message_at, c.updated_at,
       (SELECT count(*) FROM whatsapp_messages m WHERE m.chat_id = c.chat_id AND m.created_at > now() - interval '2 hours') AS msgs_2h
FROM whatsapp_chats c
WHERE c.updated_at > now() - interval '20 minutes'
ORDER BY c.updated_at DESC
LIMIT 10;

SELECT left(coalesce(body,''),70) AS body, from_me, timestamp, created_at, provider_message_id
FROM whatsapp_messages
WHERE chat_id = '34667435503@c.us'
ORDER BY timestamp DESC
LIMIT 8;
