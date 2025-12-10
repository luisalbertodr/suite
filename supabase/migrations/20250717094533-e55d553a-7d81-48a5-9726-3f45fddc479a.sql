
-- Crear función para cambiar contraseña de superusuario
CREATE OR REPLACE FUNCTION public.change_superuser_password(
  p_email text,
  p_current_password text,
  p_new_password text
)
RETURNS TABLE(
  success boolean,
  message text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user record;
  v_current_password_hash text;
  v_new_salt text;
  v_new_password_hash text;
BEGIN
  -- Buscar el superusuario por email
  SELECT * INTO v_user
  FROM public.superusers
  WHERE superusers.email = p_email
    AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false::boolean,
      'Superusuario no encontrado'::text;
    RETURN;
  END IF;
  
  -- Verificar contraseña actual
  v_current_password_hash := encode(
    digest(p_current_password || v_user.salt, 'sha256'),
    'hex'
  );
  
  IF v_current_password_hash != v_user.password_hash THEN
    RETURN QUERY SELECT 
      false::boolean,
      'Contraseña actual incorrecta'::text;
    RETURN;
  END IF;
  
  -- Validar nueva contraseña (mínimo 8 caracteres)
  IF length(p_new_password) < 8 THEN
    RETURN QUERY SELECT 
      false::boolean,
      'La nueva contraseña debe tener al menos 8 caracteres'::text;
    RETURN;
  END IF;
  
  -- Generar nuevo salt y hash para la nueva contraseña
  v_new_salt := encode(gen_random_bytes(32), 'hex');
  v_new_password_hash := encode(
    digest(p_new_password || v_new_salt, 'sha256'),
    'hex'
  );
  
  -- Actualizar contraseña
  UPDATE public.superusers 
  SET password_hash = v_new_password_hash,
      salt = v_new_salt,
      updated_at = now()
  WHERE id = v_user.id;
  
  RETURN QUERY SELECT 
    true::boolean,
    'Contraseña actualizada correctamente'::text;
END;
$$;
