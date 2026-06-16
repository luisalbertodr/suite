SELECT s.status, s.amount_cents, s.paid_at, s.stripe_checkout_session_id, s.public_token,
       l.first_name, l.phone, l.stage_id, l.stripe_deposit_paid_at,
       st.name AS stage_name
FROM stripe_deposit_sessions s
JOIN marketing_leads l ON l.id = s.marketing_lead_id
LEFT JOIN marketing_lead_stages st ON st.id = l.stage_id
WHERE s.public_token = '316425d095037901d80398fab6150b4a';

SELECT payment_success_whatsapp_message, confirmed_stage_id
FROM stripe_config
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
