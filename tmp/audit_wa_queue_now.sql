SELECT status, COUNT(*) AS n
FROM marketing_whatsapp_queue
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
GROUP BY status ORDER BY status;

SELECT marketing_queue_hour_start, marketing_queue_hour_end, marketing_queue_daily_limit,
  marketing_queue_last_sent_at, marketing_queue_next_send_at, test_mode_enabled
FROM whatsapp_automation_settings
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT l.id, l.first_name, l.last_name, l.phone, l.created_at, l.external_created_at,
  l.wa_automation_status, l.wa_automation_initial_sent_at, l.wa_automation_error,
  l.form_name, l.meta_form_id,
  q.status AS queue_status, q.error AS queue_error, q.queued_at
FROM marketing_leads l
LEFT JOIN marketing_whatsapp_queue q ON q.marketing_lead_id = l.id
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND l.archived_at IS NULL
  AND l.wa_automation_initial_sent_at IS NULL
  AND l.phone IS NOT NULL AND trim(l.phone) <> ''
  AND l.created_at > now() - interval '3 days'
ORDER BY l.created_at DESC
LIMIT 25;
