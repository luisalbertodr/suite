SELECT now() AS server_now,
       max(timestamp) AS max_ts,
       max(created_at) AS max_created,
       count(*) FILTER (WHERE created_at > now() - interval '30 minutes') AS last_30m,
       count(*) FILTER (WHERE created_at > now() - interval '2 hours') AS last_2h
FROM whatsapp_messages;

SELECT id, left(coalesce(body,''),50) AS body, type, from_me,
       to_timestamp(timestamp) AS msg_ts, created_at
FROM whatsapp_messages
ORDER BY created_at DESC
LIMIT 12;

SELECT id, name, last_message_at, updated_at
FROM whatsapp_chats
ORDER BY coalesce(last_message_at, updated_at) DESC NULLS LAST
LIMIT 8;

SELECT last_status, me_jid, last_status_at, provider, enabled
FROM whatsapp_config;
