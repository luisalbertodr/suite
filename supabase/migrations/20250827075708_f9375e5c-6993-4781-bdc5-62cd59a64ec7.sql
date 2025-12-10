-- Enable pgcrypto extension for password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Update the superuser password to "Movicas4582/*"
UPDATE public.superusers 
SET 
  salt = encode(gen_random_bytes(32), 'hex'),
  password_hash = encode(
    digest('Movicas4582/*' || encode(gen_random_bytes(32), 'hex'), 'sha256'),
    'hex'
  ),
  updated_at = now()
WHERE email = 'superuser@moges.com';

-- If no superuser exists, create one
INSERT INTO public.superusers (email, password_hash, salt, is_active)
SELECT 
  'superuser@moges.com',
  encode(
    digest('Movicas4582/*' || encode(gen_random_bytes(32), 'hex'), 'sha256'),
    'hex'
  ),
  encode(gen_random_bytes(32), 'hex'),
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.superusers WHERE email = 'superuser@moges.com'
);