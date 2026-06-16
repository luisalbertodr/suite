-- Búsqueda amplia Yurani
SELECT id, first_name, last_name, phone, phone_norm, customer_id, source,
       wa_automation_status, stripe_deposit_paid_at, created_at
FROM marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (
    first_name ILIKE '%yur%' OR last_name ILIKE '%yur%'
    OR phone_norm = '67435503'
    OR phone LIKE '%667435503%'
  )
ORDER BY created_at DESC
LIMIT 20;

-- Luis A. leads/clientes
SELECT 'lead' AS kind, id, first_name, last_name, phone, phone_norm, customer_id, source, wa_automation_status
FROM marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (
    first_name ILIKE '%luis%' OR last_name ILIKE '%diaz%' OR last_name ILIKE '%díaz%'
    OR phone_norm = '67435503'
  )
ORDER BY created_at DESC;

SELECT 'customer' AS kind, id, name, phone, phone_mobile, phone_norm
FROM customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (
    name ILIKE '%luis%' OR phone_norm = '67435503'
  );

-- Chat 667435503
SELECT chat_id, name, customer_id, marketing_lead_id, last_message_at
FROM whatsapp_chats
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND chat_id LIKE '%67435503%';

-- Depósitos stripe para Marjhory
SELECT s.id, s.status, s.amount_cents, s.paid_at, ml.first_name, ml.last_name, ml.phone
FROM stripe_deposit_sessions s
JOIN marketing_leads ml ON ml.id = s.marketing_lead_id
WHERE s.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (ml.first_name ILIKE '%marjhory%' OR ml.first_name ILIKE '%yur%');

-- Etapa Marjhory
SELECT ml.first_name, ml.last_name, st.name AS stage
FROM marketing_leads ml
LEFT JOIN marketing_lead_stages st ON st.id = ml.stage_id
WHERE ml.id = '805e495c-85cf-4252-b525-b70212cc5410';
