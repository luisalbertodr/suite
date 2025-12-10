
-- Add XML storage table for Verifactu documents
CREATE TABLE public.verifactu_xml_documents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  xml_type text NOT NULL CHECK (xml_type IN ('request', 'response')),
  xml_content text NOT NULL,
  file_path text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on XML documents table
ALTER TABLE public.verifactu_xml_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for XML documents
CREATE POLICY "Users can access their company's XML documents"
  ON public.verifactu_xml_documents
  FOR ALL
  USING (company_id = get_user_company_id());

-- Add company-specific Verifactu configuration table
CREATE TABLE public.verifactu_company_config (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE UNIQUE,
  environment text NOT NULL DEFAULT 'test' CHECK (environment IN ('test', 'production')),
  nif_emisor text NOT NULL,
  nombre_razon text NOT NULL,
  software_name text DEFAULT 'Sistema de Facturación',
  software_version text DEFAULT '1.0',
  id_software text,
  numero_instalacion text,
  hash_anterior text,
  auto_send boolean DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on company config table
ALTER TABLE public.verifactu_company_config ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for company config
CREATE POLICY "Users can access their company's Verifactu config"
  ON public.verifactu_company_config
  FOR ALL
  USING (company_id = get_user_company_id());

-- Add updated_at trigger for company config
CREATE TRIGGER update_verifactu_company_config_updated_at
  BEFORE UPDATE ON public.verifactu_company_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Improve invoices table for better Verifactu integration
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS verifactu_huella text,
ADD COLUMN IF NOT EXISTS verifactu_numero_registro text,
ADD COLUMN IF NOT EXISTS verifactu_fecha_hora_huella timestamp with time zone,
ADD COLUMN IF NOT EXISTS verifactu_version text DEFAULT '1.0',
ADD COLUMN IF NOT EXISTS tipo_factura text DEFAULT 'F1' CHECK (tipo_factura IN ('F1', 'F2', 'F3', 'F4', 'R1', 'R2', 'R3', 'R4', 'R5')),
ADD COLUMN IF NOT EXISTS clave_regimen_especial text DEFAULT '01',
ADD COLUMN IF NOT EXISTS descripcion_operacion text,
ADD COLUMN IF NOT EXISTS fecha_operacion date;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_verifactu_xml_documents_company_id ON public.verifactu_xml_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_verifactu_xml_documents_invoice_id ON public.verifactu_xml_documents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_verifactu_company_config_company_id ON public.verifactu_company_config(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_verifactu_huella ON public.invoices(verifactu_huella);
CREATE INDEX IF NOT EXISTS idx_invoices_tipo_factura ON public.invoices(tipo_factura);

-- Update certificates table to support multiple formats
ALTER TABLE public.verifactu_certificates 
ADD COLUMN IF NOT EXISTS certificate_format text DEFAULT 'p12' CHECK (certificate_format IN ('p12', 'pfx', 'pem')),
ADD COLUMN IF NOT EXISTS certificate_alias text,
ADD COLUMN IF NOT EXISTS issuer_name text,
ADD COLUMN IF NOT EXISTS subject_name text,
ADD COLUMN IF NOT EXISTS serial_number text;

-- Add validation function for Verifactu data
CREATE OR REPLACE FUNCTION public.validate_verifactu_invoice_data(
  p_invoice_id uuid
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
$$;
