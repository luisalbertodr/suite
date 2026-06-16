-- Leads en Nuevo lead sin WhatsApp inicial
SELECT COUNT(*) AS total_nuevo_lead
FROM marketing_leads l
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND l.stage_id = 'd440e946-a9ee-46f2-9e38-7d4786cb9229'
  AND l.archived_at IS NULL;

SELECT COUNT(*) AS sin_wa_inicial
FROM marketing_leads l
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND l.stage_id = 'd440e946-a9ee-46f2-9e38-7d4786cb9229'
  AND l.wa_automation_initial_sent_at IS NULL
  AND l.phone IS NOT NULL AND trim(l.phone) <> ''
  AND l.archived_at IS NULL;

SELECT wa_automation_status, COUNT(*)
FROM marketing_leads l
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND l.stage_id = 'd440e946-a9ee-46f2-9e38-7d4786cb9229'
GROUP BY wa_automation_status;

SELECT COUNT(*) AS already_in_queue
FROM marketing_whatsapp_queue q
JOIN marketing_leads l ON l.id = q.marketing_lead_id
WHERE q.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND l.stage_id = 'd440e946-a9ee-46f2-9e38-7d4786cb9229'
  AND q.status = 'pending';
