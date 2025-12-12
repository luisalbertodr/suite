-- Create missing database functions

-- Function to generate invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_company_id UUID, p_is_corrective BOOLEAN DEFAULT false)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_prefix TEXT;
  v_max_num INTEGER;
  v_new_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  v_prefix := CASE WHEN p_is_corrective THEN 'R' ELSE 'F' END || v_year || '-';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM LENGTH(v_prefix) + 1) AS INTEGER)), 0)
  INTO v_max_num
  FROM invoices
  WHERE company_id = p_company_id
    AND number LIKE v_prefix || '%';
  
  v_new_number := v_prefix || LPAD((v_max_num + 1)::TEXT, 5, '0');
  RETURN v_new_number;
END;
$$;

-- Function to generate delivery note number
CREATE OR REPLACE FUNCTION public.generate_delivery_note_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_prefix TEXT;
  v_max_num INTEGER;
  v_new_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  v_prefix := 'ALB' || v_year || '-';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM LENGTH(v_prefix) + 1) AS INTEGER)), 0)
  INTO v_max_num
  FROM delivery_notes
  WHERE company_id = p_company_id
    AND number LIKE v_prefix || '%';
  
  v_new_number := v_prefix || LPAD((v_max_num + 1)::TEXT, 5, '0');
  RETURN v_new_number;
END;
$$;

-- Function to generate planilla code
CREATE OR REPLACE FUNCTION public.generate_planilla_code(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_prefix TEXT;
  v_max_num INTEGER;
  v_new_code TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  v_prefix := 'PL' || v_year || '-';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(name FROM LENGTH(v_prefix) + 1) AS INTEGER)), 0)
  INTO v_max_num
  FROM planillas
  WHERE company_id = p_company_id
    AND name LIKE v_prefix || '%';
  
  v_new_code := v_prefix || LPAD((v_max_num + 1)::TEXT, 5, '0');
  RETURN v_new_code;
END;
$$;

-- Function to generate presupuesto_n number
CREATE OR REPLACE FUNCTION public.generate_presupuesto_n_number(p_company_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_prefix TEXT;
  v_max_num INTEGER;
  v_new_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  v_prefix := 'PN' || v_year || '-';
  
  SELECT COALESCE(MAX(CAST(SUBSTRING(number FROM LENGTH(v_prefix) + 1) AS INTEGER)), 0)
  INTO v_max_num
  FROM presupuestos_n
  WHERE company_id = p_company_id
    AND number LIKE v_prefix || '%';
  
  v_new_number := v_prefix || LPAD((v_max_num + 1)::TEXT, 5, '0');
  RETURN v_new_number;
END;
$$;

-- Function to get user permissions
CREATE OR REPLACE FUNCTION public.get_user_permissions(p_user_id UUID)
RETURNS SETOF TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT permission_id FROM user_permissions WHERE user_id = p_user_id;
$$;