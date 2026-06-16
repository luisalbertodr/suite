SELECT status, COUNT(*) AS n
FROM marketing_whatsapp_queue
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
GROUP BY status;

SELECT marketing_queue_last_sent_at, marketing_queue_next_send_at
FROM whatsapp_automation_settings
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT l.first_name, l.last_name, q.sent_at
FROM marketing_whatsapp_queue q
JOIN marketing_leads l ON l.id = q.marketing_lead_id
WHERE q.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND q.status = 'sent'
ORDER BY q.sent_at DESC
LIMIT 5;
