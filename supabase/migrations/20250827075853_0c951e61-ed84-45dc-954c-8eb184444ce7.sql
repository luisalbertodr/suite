-- Fix the superuser password storage with correct salt handling
-- First generate a proper salt and hash for the new password
DO $$
DECLARE
  new_salt text;
  new_hash text;
BEGIN
  -- Generate a new salt
  new_salt := encode(gen_random_bytes(32), 'hex');
  
  -- Create hash with the salt
  new_hash := encode(
    digest('Movicas4582/*' || new_salt, 'sha256'),
    'hex'
  );
  
  -- Update the superuser with the correct salt and hash
  UPDATE public.superusers 
  SET 
    salt = new_salt,
    password_hash = new_hash,
    updated_at = now()
  WHERE email = 'superuser@moges.com';
  
  -- If no superuser exists, create one
  IF NOT EXISTS (SELECT 1 FROM public.superusers WHERE email = 'superuser@moges.com') THEN
    INSERT INTO public.superusers (email, password_hash, salt, is_active)
    VALUES ('superuser@moges.com', new_hash, new_salt, true);
  END IF;
END $$;