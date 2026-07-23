SELECT left(coalesce(body,''),60) body, from_me, chat_id, timestamp, created_at
FROM whatsapp_messages
WHERE created_at > now() - interval '15 minutes'
ORDER BY created_at DESC
LIMIT 20;

SELECT last_status, last_status_at, me_jid FROM whatsapp_config;
