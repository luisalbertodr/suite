-- Add missing columns to match backup schema

-- customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS iban_account text,
ADD COLUMN IF NOT EXISTS re_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS irpf_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS intracomunitario text;

-- articles table
ALTER TABLE public.articles 
ADD COLUMN IF NOT EXISTS precio_compra numeric DEFAULT 0;

-- quotes table
ALTER TABLE public.quotes 
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'EUR',
ADD COLUMN IF NOT EXISTS invoiced boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS invoiced_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS invoice_id uuid;

-- presupuestos_n table
ALTER TABLE public.presupuestos_n 
ADD COLUMN IF NOT EXISTS accepted_date timestamp with time zone;

-- invoices table
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS work_order_id uuid,
ADD COLUMN IF NOT EXISTS currency text DEFAULT 'EUR',
ADD COLUMN IF NOT EXISTS paid_status boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS paid_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS verifactu_response_code text,
ADD COLUMN IF NOT EXISTS verifactu_response_message text,
ADD COLUMN IF NOT EXISTS verifactu_csv text,
ADD COLUMN IF NOT EXISTS verifactu_qr_code text,
ADD COLUMN IF NOT EXISTS verifactu_chain_data jsonb,
ADD COLUMN IF NOT EXISTS re_total numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_intracomunitario boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS verifactu_huella text,
ADD COLUMN IF NOT EXISTS verifactu_numero_registro text,
ADD COLUMN IF NOT EXISTS verifactu_fecha_hora_huella timestamp with time zone,
ADD COLUMN IF NOT EXISTS verifactu_version text DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS tipo_factura text DEFAULT 'F1',
ADD COLUMN IF NOT EXISTS clave_regimen_especial text DEFAULT '01',
ADD COLUMN IF NOT EXISTS descripcion_operacion text,
ADD COLUMN IF NOT EXISTS fecha_operacion date;

-- invoice_items table
ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS re_percentage numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS subtotal_after_discount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS iva_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS re_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS variation_id uuid;

-- article_variations table - add missing columns
ALTER TABLE public.article_variations 
ADD COLUMN IF NOT EXISTS stock_actual integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS stock_minimo integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS precio numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS precio_compra numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS estado text DEFAULT 'activo',
ADD COLUMN IF NOT EXISTS iva_percentage numeric DEFAULT 21;

-- Create article_families table if it doesn't exist (for backup compatibility)
CREATE TABLE IF NOT EXISTS public.article_families (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    company_id uuid NOT NULL REFERENCES public.companies(id),
    name text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS on article_families
ALTER TABLE public.article_families ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for article_families
DROP POLICY IF EXISTS "Users can view article families in their company" ON public.article_families;
CREATE POLICY "Users can view article families in their company" 
ON public.article_families 
FOR SELECT 
USING (company_id = get_user_company_id());

DROP POLICY IF EXISTS "Users can manage article families in their company" ON public.article_families;
CREATE POLICY "Users can manage article families in their company" 
ON public.article_families 
FOR ALL 
USING (company_id = get_user_company_id());