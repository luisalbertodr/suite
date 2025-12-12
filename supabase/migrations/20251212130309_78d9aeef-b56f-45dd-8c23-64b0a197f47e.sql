-- Add missing columns and create missing tables

-- Add customer_name to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS customer_name text;

-- Create verifactu_certificates table if missing
CREATE TABLE IF NOT EXISTS public.verifactu_certificates (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id),
    certificate_name text NOT NULL,
    certificate_data text,
    certificate_password_encrypted text,
    expiry_date date,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE public.verifactu_certificates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view verifactu certs in their company" ON public.verifactu_certificates;
CREATE POLICY "Users can view verifactu certs in their company" ON public.verifactu_certificates 
FOR SELECT USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Admins can manage verifactu certs" ON public.verifactu_certificates;
CREATE POLICY "Admins can manage verifactu certs" ON public.verifactu_certificates 
FOR ALL USING (company_id = get_user_company_id() AND is_admin());