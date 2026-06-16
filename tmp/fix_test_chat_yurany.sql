SELECT marketing_lead_id FROM whatsapp_chats WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND chat_id = '34667435503@c.us';

UPDATE whatsapp_chats
SET marketing_lead_id = NULL, updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND chat_id = '34667435503@c.us'
  AND marketing_lead_id IS NOT NULL;

SELECT chat_id, customer_id, marketing_lead_id FROM whatsapp_chats
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND chat_id = '34667435503@c.us';
