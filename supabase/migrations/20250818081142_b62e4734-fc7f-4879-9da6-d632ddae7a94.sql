-- Create queue table for offline operations
CREATE TABLE IF NOT EXISTS public.verifactu_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL,
  invoice_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('send', 'query', 'cancel')),
  request_data JSONB NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'success', 'failed', 'cancelled')),
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on the queue table
ALTER TABLE public.verifactu_queue ENABLE ROW LEVEL SECURITY;

-- Create policies for verifactu_queue
CREATE POLICY "Users can view their company's queue items" 
ON public.verifactu_queue 
FOR SELECT 
USING (
  company_id IN (
    SELECT company_id 
    FROM user_profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can insert queue items for their company" 
ON public.verifactu_queue 
FOR INSERT 
WITH CHECK (
  company_id IN (
    SELECT company_id 
    FROM user_profiles 
    WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Users can update their company's queue items" 
ON public.verifactu_queue 
FOR UPDATE 
USING (
  company_id IN (
    SELECT company_id 
    FROM user_profiles 
    WHERE user_id = auth.uid()
  )
);

-- Add indexes for better performance
CREATE INDEX idx_verifactu_queue_company_status ON public.verifactu_queue(company_id, status);
CREATE INDEX idx_verifactu_queue_next_retry ON public.verifactu_queue(next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_verifactu_queue_invoice ON public.verifactu_queue(invoice_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_verifactu_queue_updated_at
BEFORE UPDATE ON public.verifactu_queue
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add environment configuration to company config
ALTER TABLE public.verifactu_company_config 
ADD COLUMN IF NOT EXISTS endpoint_url TEXT,
ADD COLUMN IF NOT EXISTS timeout_seconds INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS retry_delay_seconds INTEGER DEFAULT 60;

-- Update existing configs with default endpoints
UPDATE public.verifactu_company_config 
SET 
  endpoint_url = CASE 
    WHEN environment = 'production' THEN 'https://www7.aeat.es/wlpl/TIKE-CONT-WS/ws/VeriFactu'
    ELSE 'https://prewww7.aeat.es/wlpl/TIKE-CONT-WS/ws/VeriFactu'
  END
WHERE endpoint_url IS NULL;