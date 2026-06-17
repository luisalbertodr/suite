SELECT status, COUNT(*) FROM marketing_whatsapp_queue WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' GROUP BY status;
SELECT COUNT(*) AS sin_wa_ni_cola
FROM marketing_leads l
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND l.archived_at IS NULL
  AND l.wa_automation_initial_sent_at IS NULL
  AND l.phone IS NOT NULL AND trim(l.phone) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM marketing_whatsapp_queue q
    WHERE q.marketing_lead_id = l.id AND q.status IN ('pending', 'sent')
  );
