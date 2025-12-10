-- Add foreign key constraints to verifactu_queue table
-- This ensures referential integrity and enables proper joins in queries

-- Add foreign key for company_id
ALTER TABLE public.verifactu_queue
ADD CONSTRAINT verifactu_queue_company_id_fkey 
FOREIGN KEY (company_id) 
REFERENCES public.companies(id) 
ON DELETE CASCADE;

-- Add foreign key for invoice_id
ALTER TABLE public.verifactu_queue
ADD CONSTRAINT verifactu_queue_invoice_id_fkey 
FOREIGN KEY (invoice_id) 
REFERENCES public.invoices(id) 
ON DELETE CASCADE;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_verifactu_queue_company_id 
ON public.verifactu_queue(company_id);

CREATE INDEX IF NOT EXISTS idx_verifactu_queue_invoice_id 
ON public.verifactu_queue(invoice_id);

CREATE INDEX IF NOT EXISTS idx_verifactu_queue_status_next_retry 
ON public.verifactu_queue(status, next_retry_at) 
WHERE status = 'pending';