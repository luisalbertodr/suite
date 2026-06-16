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
  '7ba3f3bb-8a29-4994-b2dc-dda6a34adc02',
  md5(random()::text || clock_timestamp()::text),
  1000,
  'eur',
  'pending',
  now() + interval '7 days',
  '{"source":"manual_test"}'::jsonb
)
RETURNING public_token, marketing_lead_id;
