SELECT id, form_name, whatsapp_automation_enabled,
  length(whatsapp_initial_message) AS msg_len
FROM meta_forms
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

-- Leads without meta_form_id but with form_name - can they match?
SELECT l.id, l.form_name, l.meta_form_id, l.phone IS NOT NULL AS has_phone
FROM marketing_leads l
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND l.stage_id = 'd440e946-a9ee-46f2-9e38-7d4786cb9229'
  AND l.wa_automation_initial_sent_at IS NULL
  AND l.meta_form_id IS NULL
LIMIT 20;
