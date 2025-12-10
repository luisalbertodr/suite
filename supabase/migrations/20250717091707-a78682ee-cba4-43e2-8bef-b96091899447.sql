
-- Crear tabla para superusuarios
CREATE TABLE IF NOT EXISTS public.superusers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  salt text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Habilitar RLS en la tabla superusers
ALTER TABLE public.superusers ENABLE ROW LEVEL SECURITY;

-- Política que permite solo operaciones desde funciones edge con service role
CREATE POLICY "Allow superuser operations from service role only" 
  ON public.superusers 
  FOR ALL 
  USING (true) 
  WITH CHECK (true);

-- Función para verificar credenciales de superusuario
CREATE OR REPLACE FUNCTION public.verify_superuser_credentials(
  p_email text,
  p_password text
)
RETURNS TABLE(
  user_id uuid,
  email text,
  is_valid boolean,
  last_login timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
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
  
  -- Generar hash con el salt almacenado
  v_password_hash := encode(
    digest(p_password || v_user.salt, 'sha256'),
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

-- Función para crear superusuario
CREATE OR REPLACE FUNCTION public.create_superuser(
  p_email text,
  p_password text
)
RETURNS TABLE(
  user_id uuid,
  email text,
  created boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_salt text;
  v_password_hash text;
  v_user_id uuid;
BEGIN
  -- Generar salt aleatorio
  v_salt := encode(gen_random_bytes(32), 'hex');
  
  -- Generar hash de la contraseña
  v_password_hash := encode(
    digest(p_password || v_salt, 'sha256'),
    'hex'
  );
  
  -- Insertar nuevo superusuario
  INSERT INTO public.superusers (email, password_hash, salt)
  VALUES (p_email, v_password_hash, v_salt)
  RETURNING id INTO v_user_id;
  
  RETURN QUERY SELECT 
    v_user_id,
    p_email,
    true::boolean;
    
EXCEPTION
  WHEN unique_violation THEN
    RETURN QUERY SELECT 
      NULL::uuid,
      ''::text,
      false::boolean;
END;
$$;

-- Trigger para actualizar updated_at
CREATE OR REPLACE TRIGGER update_superusers_updated_at
  BEFORE UPDATE ON public.superusers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insertar superusuario por defecto (temporal para migración)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.superusers WHERE email = 'superuser@moges.com') THEN
    PERFORM public.create_superuser('superuser@moges.com', 'superuser123');
  END IF;
END $$;
