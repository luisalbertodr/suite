-- Notificación retroactiva: pago Luis A. (sesión ya paid antes del feature)
WITH recipients AS (
  SELECT DISTINCT up.user_id
  FROM user_profiles up
  WHERE up.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    AND public.user_has_effective_permission(up.user_id, 'marketing', 'read')
),
session AS (
  SELECT id FROM stripe_deposit_sessions
  WHERE public_token = '316425d095037901d80398fab6150b4a'
    AND status = 'paid'
  LIMIT 1
)
INSERT INTO notifications (
  company_id,
  user_id,
  title,
  message,
  type,
  link,
  read,
  metadata
)
SELECT
  '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4',
  r.user_id,
  'Señal Stripe · Luis A.',
  'Luis A. (+34667435503) ha confirmado el pago de la señal: 10,00 €.',
  'stripe_deposit_paid',
  '/marketing',
  false,
  jsonb_build_object(
    'stripe_deposit_session_id', s.id,
    'marketing_lead_id', '09da0e69-bfb7-4878-a1ab-8e19c042e199',
    'amount_cents', 1000,
    'currency', 'eur',
    'phone', '+34667435503',
    'form_name', 'Método Skin Lipoout',
    'campaign', '3. [TPE] – Leads – [Método Skin Lipoout] – [Mayo 2026]',
    'retroactive', true
  )
FROM recipients r
CROSS JOIN session s
WHERE NOT EXISTS (
  SELECT 1 FROM notifications n
  WHERE n.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
    AND n.type = 'stripe_deposit_paid'
    AND n.metadata->>'stripe_deposit_session_id' = s.id::text
    AND n.user_id = r.user_id
)
RETURNING user_id, title;
