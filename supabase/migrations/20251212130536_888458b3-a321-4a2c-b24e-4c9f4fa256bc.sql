-- Add missing columns to verifactu_certificates table
ALTER TABLE public.verifactu_certificates
ADD COLUMN IF NOT EXISTS valid_from TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS valid_until TIMESTAMP WITH TIME ZONE;

-- Create verifactu_company_config table
CREATE TABLE IF NOT EXISTS public.verifactu_company_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  environment TEXT DEFAULT 'test',
  nif_emisor TEXT,
  nombre_razon TEXT,
  software_name TEXT DEFAULT 'Sistema de Facturación',
  software_version TEXT DEFAULT '1.0',
  id_software TEXT,
  numero_instalacion TEXT,
  hash_anterior TEXT,
  auto_send BOOLEAN DEFAULT false,
  endpoint_url TEXT,
  timeout_seconds INTEGER DEFAULT 30,
  max_retries INTEGER DEFAULT 3,
  retry_delay_seconds INTEGER DEFAULT 60,
  enable_xades_signature BOOLEAN DEFAULT false,
  xades_signature_type TEXT DEFAULT 'XAdES-BES',
  include_timestamp BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE public.verifactu_company_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view verifactu config in their company"
  ON public.verifactu_company_config
  FOR SELECT
  USING (company_id = get_user_company_id());

CREATE POLICY "Users can manage verifactu config in their company"
  ON public.verifactu_company_config
  FOR ALL
  USING (company_id = get_user_company_id());