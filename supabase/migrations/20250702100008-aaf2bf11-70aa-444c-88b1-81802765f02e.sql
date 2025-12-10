
-- Add Verifactu-related columns to the invoices table
ALTER TABLE public.invoices 
ADD COLUMN verifactu_status text DEFAULT 'pending' CHECK (verifactu_status IN ('pending', 'sent', 'accepted', 'rejected', 'error')),
ADD COLUMN verifactu_sent_at timestamp with time zone,
ADD COLUMN verifactu_response_code text,
ADD COLUMN verifactu_response_message text,
ADD COLUMN verifactu_csv text,
ADD COLUMN verifactu_qr_code text,
ADD COLUMN is_corrective boolean DEFAULT false,
ADD COLUMN corrective_reason text,
ADD COLUMN original_invoice_id uuid REFERENCES public.invoices(id),
ADD COLUMN verifactu_chain_data jsonb;

-- Create Verifactu certificates table
CREATE TABLE public.verifactu_certificates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  certificate_name text NOT NULL,
  certificate_data text NOT NULL, -- Base64 encoded certificate
  certificate_password text NOT NULL, -- Encrypted password
  is_active boolean DEFAULT true,
  valid_from timestamp with time zone,
  valid_until timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on certificates table
ALTER TABLE public.verifactu_certificates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for certificates
CREATE POLICY "Users can access their company's certificates"
  ON public.verifactu_certificates
  FOR ALL
  USING (company_id = get_user_company_id());

-- Create Verifactu log table for audit trail
CREATE TABLE public.verifactu_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE,
  action text NOT NULL,
  request_data jsonb,
  response_data jsonb,
  status text NOT NULL,
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on logs table
ALTER TABLE public.verifactu_logs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for logs
CREATE POLICY "Users can access their company's verifactu logs"
  ON public.verifactu_logs
  FOR ALL
  USING (company_id = get_user_company_id());

-- Add updated_at trigger for certificates
CREATE TRIGGER update_verifactu_certificates_updated_at
  BEFORE UPDATE ON public.verifactu_certificates
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_invoices_verifactu_status ON public.invoices(verifactu_status);
CREATE INDEX idx_invoices_verifactu_sent_at ON public.invoices(verifactu_sent_at);
CREATE INDEX idx_verifactu_logs_invoice_id ON public.verifactu_logs(invoice_id);
CREATE INDEX idx_verifactu_logs_created_at ON public.verifactu_logs(created_at);
