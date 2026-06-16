SELECT id, first_name, last_name, phone, phone_norm, stage_id, form_name, meta_form_id
FROM marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND phone LIKE '%667435503%'
ORDER BY created_at DESC
LIMIT 5;
