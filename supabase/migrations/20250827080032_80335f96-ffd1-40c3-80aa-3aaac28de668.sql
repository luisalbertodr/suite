-- Ensure pgcrypto extension is properly enabled
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
CREATE EXTENSION pgcrypto;

-- Recreate the verify_superuser_credentials function with proper error handling
CREATE OR REPLACE FUNCTION public.verify_superuser_credentials(p_email text, p_password text)
RETURNS TABLE(user_id uuid, email text, is_valid boolean, last_login timestamp with time zone)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user record;
  v_password_hash text;
BEGIN
  -- Buscar el superusuario por email
  SELECT * INTO v_user
  FROM public.superusers
  WHERE superusers.email = p_email
    AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      NULL::uuid,
      ''::text,
      false::boolean,
      NULL::timestamp with time zone;
    RETURN;
  END IF;
  
  -- Generar hash con el salt almacenado usando pgcrypto
  v_password_hash := encode(
    digest(p_password || v_user.salt, 'sha256'::text),
    'hex'
  );
  
  -- Verificar si la contraseña coincide
  IF v_password_hash = v_user.password_hash THEN
    -- Actualizar last_login_at
    UPDATE public.superusers 
    SET last_login_at = now(),
        updated_at = now()
    WHERE id = v_user.id;
    
    RETURN QUERY SELECT 
      v_user.id,
      v_user.email,
      true::boolean,
      now()::timestamp with time zone;
  ELSE
    RETURN QUERY SELECT 
      NULL::uuid,
      ''::text,
      false::boolean,
      NULL::timestamp with time zone;
  END IF;
END;
$$;

-- Now update the superuser password with the correct hash using pgcrypto
DO $$
DECLARE
  new_salt text;
  new_hash text;
BEGIN
  -- Generate a new salt
  new_salt := encode(gen_random_bytes(32), 'hex');
  
  -- Create hash with the salt using pgcrypto
  new_hash := encode(
    digest('Movicas4582/*' || new_salt, 'sha256'::text),
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