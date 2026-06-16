-- Leads Yurani / Marjhory Romelyn
SELECT id, first_name, last_name, phone, phone_norm, customer_id, source,
       wa_automation_status, stripe_deposit_paid_at, archived_at, created_at
FROM marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (
    first_name ILIKE '%yurani%' OR last_name ILIKE '%yurani%'
    OR first_name ILIKE '%marjhory%' OR last_name ILIKE '%marjhory%'
    OR first_name ILIKE '%romelyn%' OR last_name ILIKE '%romelyn%'
  )
ORDER BY created_at DESC;

-- Chats vinculados
SELECT w.chat_id, w.name AS chat_name, w.customer_id, w.marketing_lead_id,
       ml.first_name, ml.last_name, ml.phone AS lead_phone
FROM whatsapp_chats w
LEFT JOIN marketing_leads ml ON ml.id = w.marketing_lead_id
WHERE w.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND w.marketing_lead_id IN (
    SELECT id FROM marketing_leads
    WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
      AND (
        first_name ILIKE '%yurani%' OR last_name ILIKE '%yurani%'
        OR first_name ILIKE '%marjhory%' OR last_name ILIKE '%marjhory%'
        OR first_name ILIKE '%romelyn%' OR last_name ILIKE '%romelyn%'
      )
  );

-- Cliente Luis Alberto (667435503) por referencia
SELECT id, name, phone, phone_mobile, phone_norm
FROM customers
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND phone_norm = '67435503';

-- Cola WA
SELECT q.status, q.sent_at, ml.first_name, ml.last_name, ml.phone
FROM marketing_whatsapp_queue q
JOIN marketing_leads ml ON ml.id = q.marketing_lead_id
WHERE q.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND (
    ml.first_name ILIKE '%yurani%' OR ml.last_name ILIKE '%yurani%'
    OR ml.first_name ILIKE '%marjhory%' OR ml.last_name ILIKE '%marjhory%'
    OR ml.first_name ILIKE '%romelyn%' OR ml.last_name ILIKE '%romelyn%'
  );
