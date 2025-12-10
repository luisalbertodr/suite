-- Add XAdES signature columns to verifactu_company_config table
ALTER TABLE public.verifactu_company_config 
ADD COLUMN enable_xades_signature boolean DEFAULT false,
ADD COLUMN xades_signature_type text DEFAULT 'XAdES-BES',
ADD COLUMN include_timestamp boolean DEFAULT false;