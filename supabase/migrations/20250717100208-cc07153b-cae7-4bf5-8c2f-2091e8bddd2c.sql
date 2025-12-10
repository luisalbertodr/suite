
-- Fase 1: Corrección de funciones de base de datos para añadir SET search_path = public

-- 1. Actualizar función set_ticket_number
CREATE OR REPLACE FUNCTION public.set_ticket_number()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  IF NEW.ticket_number IS NULL OR NEW.ticket_number = '' THEN
    NEW.ticket_number := generate_ticket_number(NEW.company_id);
  END IF;
  RETURN NEW;
END;
$function$;

-- 2. Actualizar función get_user_permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(user_id uuid, company_id uuid)
 RETURNS TABLE(permission_name text, resource text, action text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
  RETURN QUERY
  -- Permisos desde roles
  SELECT DISTINCT p.name, p.resource, p.action
  FROM public.permissions p
  JOIN public.role_permissions rp ON p.id = rp.permission_id
  JOIN public.roles r ON rp.role_id = r.id
  JOIN public.user_company_roles ucr ON r.id = ucr.role_id
  WHERE ucr.user_id = $1 AND ucr.company_id = $2
  
  UNION
  
  -- Permisos individuales
  SELECT DISTINCT p.name, p.resource, p.action
  FROM public.permissions p
  JOIN public.user_permissions up ON p.id = up.permission_id
  WHERE up.user_id = $1 AND up.company_id = $2;
END;
$function$;

-- 3. Actualizar función generate_invoice_number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(company_id uuid, prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  -- Lock the table to prevent race conditions
  LOCK TABLE public.invoices IN EXCLUSIVE MODE;
  
  -- Get the highest number for this company and prefix
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(number FROM (prefix || '-(\d+)$')) AS INTEGER
      )
    ), 0
  ) + 1
  INTO next_number
  FROM public.invoices
  WHERE invoices.company_id = generate_invoice_number.company_id
    AND number ~ ('^' || prefix || '-\d+$');
  
  -- Format the new number
  new_number := prefix || '-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_number;
END;
$function$;

-- 4. Actualizar función generate_planilla_code
CREATE OR REPLACE FUNCTION public.generate_planilla_code(company_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  next_number INTEGER;
  new_code TEXT;
BEGIN
  -- Obtener el siguiente número para esta empresa específica
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(codigo FROM 'PL-(\d+)$') AS INTEGER
      )
    ), 0
  ) + 1
  INTO next_number
  FROM public.planillas
  WHERE planillas.company_id = generate_planilla_code.company_id
    AND codigo ~ '^PL-\d+$';
  
  -- Formatear el nuevo código
  new_code := 'PL-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_code;
END;
$function$;

-- 5. Actualizar función validate_verifactu_invoice_data
CREATE OR REPLACE FUNCTION public.validate_verifactu_invoice_data(p_invoice_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_invoice record;
  v_company record;
  v_customer record;
BEGIN
  -- Get invoice data
  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice not found';
  END IF;
  
  -- Get company data
  SELECT * INTO v_company
  FROM public.companies
  WHERE id = v_invoice.company_id;
  
  -- Get customer data
  SELECT * INTO v_customer
  FROM public.customers
  WHERE id = v_invoice.customer_id;
  
  -- Validate required fields
  IF v_company.tax_id IS NULL OR v_company.tax_id = '' THEN
    RAISE EXCEPTION 'Company tax ID is required for Verifactu';
  END IF;
  
  IF v_customer.tax_id IS NULL OR v_customer.tax_id = '' THEN
    RAISE EXCEPTION 'Customer tax ID is required for Verifactu';
  END IF;
  
  IF v_invoice.total_amount IS NULL OR v_invoice.total_amount <= 0 THEN
    RAISE EXCEPTION 'Invoice total amount must be greater than 0';
  END IF;
  
  RETURN true;
END;
$function$;

-- 6. Actualizar función verify_superuser_credentials
CREATE OR REPLACE FUNCTION public.verify_superuser_credentials(p_email text, p_password text)
 RETURNS TABLE(user_id uuid, email text, is_valid boolean, last_login timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- 7. Actualizar función generate_delivery_note_number
CREATE OR REPLACE FUNCTION public.generate_delivery_note_number(company_id uuid, prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  -- Lock the table to prevent race conditions
  LOCK TABLE public.delivery_notes IN EXCLUSIVE MODE;
  
  -- Get the highest number for this company and prefix
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(number FROM (prefix || '-(\d+)$')) AS INTEGER
      )
    ), 0
  ) + 1
  INTO next_number
  FROM public.delivery_notes
  WHERE delivery_notes.company_id = generate_delivery_note_number.company_id
    AND number ~ ('^' || prefix || '-\d+$');
  
  -- Format the new number
  new_number := prefix || '-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_number;
END;
$function$;

-- 8. Actualizar función generate_ticket_number
CREATE OR REPLACE FUNCTION public.generate_ticket_number(company_uuid uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
DECLARE
  next_number INTEGER;
  ticket_num TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
BEGIN
  LOOP
    -- Bloquear la tabla para prevenir condiciones de carrera
    LOCK TABLE public.sales IN EXCLUSIVE MODE;
    
    -- Obtener el siguiente número de ticket para esta empresa específica
    SELECT COALESCE(MAX(CAST(SUBSTRING(ticket_number FROM 'TPV-(\d+)') AS INTEGER)), 0) + 1
    INTO next_number
    FROM public.sales
    WHERE ticket_number ~ '^TPV-\d+$' 
    AND company_id = company_uuid;
    
    -- Formatear el número de ticket
    ticket_num := 'TPV-' || LPAD(next_number::TEXT, 6, '0');
    
    -- Verificar si ya existe este número para esta empresa
    IF NOT EXISTS (SELECT 1 FROM public.sales WHERE ticket_number = ticket_num AND company_id = company_uuid) THEN
      RETURN ticket_num;
    END IF;
    
    -- Si llegamos aquí, hubo un conflicto, intentar de nuevo
    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      -- Como último recurso, usar timestamp para garantizar unicidad
      ticket_num := 'TPV-' || LPAD(next_number::TEXT, 6, '0') || '-' || EXTRACT(EPOCH FROM NOW())::INTEGER;
      RETURN ticket_num;
    END IF;
    
  END LOOP;
END;
$function$;

-- 9. Actualizar función create_superuser
CREATE OR REPLACE FUNCTION public.create_superuser(p_email text, p_password text)
 RETURNS TABLE(user_id uuid, email text, created boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- 10. Actualizar función generate_quote_number
CREATE OR REPLACE FUNCTION public.generate_quote_number(company_id uuid, prefix text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  -- Lock the table to prevent race conditions
  LOCK TABLE public.quotes IN EXCLUSIVE MODE;
  
  -- Get the highest number for this specific company and prefix
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(number FROM ('^' || replace(replace(replace(prefix, '\', '\\'), '.', '\.'), '+', '\+') || '-(\d+)$')) AS INTEGER
      )
    ), 0
  ) + 1
  INTO next_number
  FROM public.quotes
  WHERE quotes.company_id = generate_quote_number.company_id
    AND number ~ ('^' || replace(replace(replace(prefix, '\', '\\'), '.', '\.'), '+', '\+') || '-\d+$');
  
  -- Format the new number with 6-digit padding
  new_number := prefix || '-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_number;
END;
$function$;

-- 11. Actualizar función change_superuser_password
CREATE OR REPLACE FUNCTION public.change_superuser_password(p_email text, p_current_password text, p_new_password text)
 RETURNS TABLE(success boolean, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
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
$function$;

-- 12. Actualizar función update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$function$;

-- 13. Actualizar función get_user_company_id
CREATE OR REPLACE FUNCTION public.get_user_company_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path = public
AS $function$
  SELECT COALESCE(
    (SELECT company_id FROM public.user_profiles WHERE user_id = auth.uid()),
    (SELECT id FROM public.companies LIMIT 1)
  );
$function$;

-- 14. Actualizar función update_article_stock_and_price
CREATE OR REPLACE FUNCTION public.update_article_stock_and_price(
  article_id uuid,
  quantity_received numeric,
  new_purchase_price numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Update article stock and purchase price
  UPDATE public.articles 
  SET 
    stock_actual = stock_actual + quantity_received,
    precio_compra = new_purchase_price,
    updated_at = NOW()
  WHERE id = article_id;
END;
$function$;

-- 15. Crear función user_has_permission con SET search_path
CREATE OR REPLACE FUNCTION public.user_has_permission(user_id uuid, company_id uuid, permission_name text)
RETURNS boolean 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.get_user_permissions(user_id, company_id) p
    WHERE p.permission_name = $3
  );
END;
$function$;
