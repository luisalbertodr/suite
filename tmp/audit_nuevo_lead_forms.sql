-- Forms with automation
SELECT id, form_name, whatsapp_automation_enabled,
  length(whatsapp_initial_message) AS msg_len
FROM marketing_meta_forms
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

-- Sample leads form_name vs meta_form_id
SELECT 
  COUNT(*) FILTER (WHERE meta_form_id IS NOT NULL) AS with_meta_form_id,
  COUNT(*) FILTER (WHERE meta_form_id IS NULL) AS without_meta_form_id,
  COUNT(*) FILTER (WHERE form_name IS NOT NULL AND trim(form_name) <> '') AS with_form_name
FROM marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND stage_id = 'd440e946-a9ee-46f2-9e38-7d4786cb9229'
  AND wa_automation_initial_sent_at IS NULL
  AND archived_at IS NULL;

SELECT DISTINCT form_name FROM marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND stage_id = 'd440e946-a9ee-46f2-9e38-7d4786cb9229'
  AND wa_automation_initial_sent_at IS NULL
ORDER BY form_name;
