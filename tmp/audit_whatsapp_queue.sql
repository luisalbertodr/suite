-- Auditoría cola WA marketing (Lipoout)
\set company_id '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'

SELECT status, COUNT(*) AS n
FROM marketing_whatsapp_queue
WHERE company_id = :'company_id'
GROUP BY status
ORDER BY status;

SELECT
  q.status,
  q.error,
  q.queued_at,
  q.sent_at,
  l.first_name,
  l.last_name,
  l.phone,
  l.campaign,
  l.form_name,
  l.meta_form_id,
  l.wa_automation_initial_sent_at,
  l.wa_automation_status
FROM marketing_whatsapp_queue q
JOIN marketing_leads l ON l.id = q.marketing_lead_id
WHERE q.company_id = :'company_id'
ORDER BY q.queued_at DESC
LIMIT 40;

SELECT
  marketing_queue_hour_start,
  marketing_queue_hour_end,
  marketing_queue_daily_limit,
  marketing_queue_min_pause_seconds,
  marketing_queue_max_pause_seconds,
  marketing_queue_last_sent_at,
  marketing_queue_next_send_at,
  test_mode_enabled,
  test_phone
FROM whatsapp_automation_settings
WHERE company_id = :'company_id';

SELECT COUNT(*) AS pending_now
FROM marketing_whatsapp_queue
WHERE company_id = :'company_id' AND status = 'pending';

-- Leads elegibles sin encolar (sin wa inicial, con teléfono)
SELECT COUNT(*) AS eligible_leads_no_initial
FROM marketing_leads l
WHERE l.company_id = :'company_id'
  AND l.archived_at IS NULL
  AND l.phone IS NOT NULL AND trim(l.phone) <> ''
  AND l.wa_automation_initial_sent_at IS NULL;

-- Meta forms automation status
SELECT id, form_name, whatsapp_automation_enabled,
  length(trim(whatsapp_initial_message)) AS msg_len
FROM meta_forms
WHERE company_id = :'company_id'
ORDER BY form_name;
