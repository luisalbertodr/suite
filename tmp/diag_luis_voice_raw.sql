SELECT wm.waha_message_id, wm.type, wm.ack, wm.media_mime_type, wm.media_size,
       wm.timestamp, wm.raw
FROM whatsapp_messages wm
WHERE wm.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND wm.waha_message_id = 'true_34667435503@c.us_3EB000FDEDBA20EE2AF098';

SELECT wm.waha_message_id, wm.type, wm.ack, wm.body, wm.timestamp
FROM whatsapp_messages wm
WHERE wm.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND wm.chat_id = '34667435503@c.us'
  AND wm.type IN ('voice', 'audio', 'ptt')
  AND wm.from_me = true
ORDER BY wm.timestamp DESC
LIMIT 5;
