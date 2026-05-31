#!/bin/bash
docker exec -i supabase-db psql -U postgres -d postgres <<'"'"'SQL'"'"'
SELECT chat_id, left(name,15) AS name, linked, left(preview,40) AS preview, last_message_at
FROM (
  SELECT chat_id, name, customer_id IS NOT NULL AS linked, last_message_preview AS preview, last_message_at
  FROM whatsapp_chats WHERE NOT archived ORDER BY last_message_at DESC NULLS LAST LIMIT 8
) t;
SELECT count(*) FROM whatsapp_messages WHERE chat_id ~* '"'"'@broadcast'"'"';
SQL