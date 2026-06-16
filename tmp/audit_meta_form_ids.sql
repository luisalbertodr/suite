-- meta_form_id distribution for nuevo lead
SELECT mf.form_name, mf.whatsapp_automation_enabled, COUNT(*) 
FROM marketing_leads l
LEFT JOIN meta_forms mf ON mf.id = l.meta_form_id
WHERE l.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND l.stage_id = 'd440e946-a9ee-46f2-9e38-7d4786cb9229'
  AND l.wa_automation_initial_sent_at IS NULL
GROUP BY mf.form_name, mf.whatsapp_automation_enabled;

-- Leads with phone null
SELECT COUNT(*) FROM marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND stage_id = 'd440e946-a9ee-46f2-9e38-7d4786cb9229'
  AND wa_automation_initial_sent_at IS NULL
  AND (phone IS NULL OR trim(phone) = '');
