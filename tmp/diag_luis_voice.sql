-- Chats Luis Alberto Díaz
SELECT wc.chat_id, wc.name, wc.customer_id, c.name AS customer_name
FROM whatsapp_chats wc
LEFT JOIN customers c ON c.id = wc.customer_id
WHERE wc.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (
    wc.name ILIKE '%luis%alberto%'
    OR wc.chat_id LIKE '%34667435503%'
    OR c.name ILIKE '%luis%alberto%diaz%'
  );

-- Últimos mensajes salientes a Luis (texto vs voz)
SELECT wm.waha_message_id, wm.chat_id, wm.type, wm.ack, wm.timestamp,
       LEFT(COALESCE(wm.body, wm.caption, ''), 40) AS preview,
       wm.raw->'ack' AS raw_ack,
       wm.raw->'key'->>'remoteJid' AS raw_remote,
       wm.raw->'key'->>'remoteJidAlt' AS raw_remote_alt
FROM whatsapp_messages wm
WHERE wm.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND wm.chat_id LIKE '%34667435503%'
  AND wm.from_me = true
ORDER BY wm.timestamp DESC
LIMIT 25;

-- Provider config
SELECT provider, session_name, LEFT(waha_base_url, 60) AS base_url
FROM whatsapp_config
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
