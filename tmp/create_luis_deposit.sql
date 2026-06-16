-- Cancel any stale pending session for this lead (optional cleanup)
UPDATE stripe_deposit_sessions
SET status = 'expired', updated_at = now()
WHERE marketing_lead_id = '09da0e69-bfb7-4878-a1ab-8e19c042e199'
  AND status = 'pending';

INSERT INTO stripe_deposit_sessions (
  company_id,
  marketing_lead_id,
  public_token,
  amount_cents,
  currency,
  status,
  expires_at,
  metadata
) VALUES (
  '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4',
  '09da0e69-bfb7-4878-a1ab-8e19c042e199',
  md5(random()::text || clock_timestamp()::text),
  1000,
  'eur',
  'pending',
  now() + interval '7 days',
  '{"source":"manual_link_luis"}'::jsonb
)
RETURNING public_token, marketing_lead_id, amount_cents;
