-- Detalle completo ambos leads
SELECT ml.id, ml.first_name, ml.last_name, ml.phone, ml.wa_automation_status,
       ml.wa_automation_initial_sent_at, ml.wa_automation_error, ml.form_name, ml.campaign,
       st.name AS stage
FROM marketing_leads ml
LEFT JOIN marketing_lead_stages st ON st.id = ml.stage_id
WHERE ml.id IN (
  'ac239239-99fb-4d12-b26f-82e96f2682b4',
  '805e495c-85cf-4252-b525-b70212cc5410',
  '09da0e69-bfb7-4878-a1ab-8e19c042e199'
);

-- Log automatización
SELECT automation_type, reference_id, intended_phone, sent_to_phone, success, created_at, message_preview
FROM whatsapp_automation_send_log
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (
    reference_id IN (
      'ac239239-99fb-4d12-b26f-82e96f2682b4',
      '805e495c-85cf-4252-b525-b70212cc5410'
    )
    OR intended_phone LIKE '%647639219%' OR intended_phone LIKE '%611569893%'
  )
ORDER BY created_at DESC
LIMIT 15;

-- Cola
SELECT * FROM marketing_whatsapp_queue
WHERE marketing_lead_id IN (
  'ac239239-99fb-4d12-b26f-82e96f2682b4',
  '805e495c-85cf-4252-b525-b70212cc5410'
);

-- Leads erróneos whatsapp source recientes
SELECT id, first_name, last_name, phone, source, created_at
FROM marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND source = 'whatsapp'
  AND created_at > '2026-06-15'
ORDER BY created_at DESC;
