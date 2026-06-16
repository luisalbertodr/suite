SELECT id, campaign, form_name, source, meta_form_id, created_at::date
FROM marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND stage_id = 'd440e946-a9ee-46f2-9e38-7d4786cb9229'
  AND wa_automation_initial_sent_at IS NULL
  AND meta_form_id IS NULL
ORDER BY created_at;
