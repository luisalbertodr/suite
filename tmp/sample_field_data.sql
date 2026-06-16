SELECT id, form_name, form_id, whatsapp_automation_enabled
FROM meta_forms
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';

SELECT form_name, field_data
FROM marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND form_name ILIKE '%Body%'
ORDER BY created_at DESC
LIMIT 1;

SELECT form_name, field_data
FROM marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND form_name ILIKE '%Skin%'
ORDER BY created_at DESC
LIMIT 1;
