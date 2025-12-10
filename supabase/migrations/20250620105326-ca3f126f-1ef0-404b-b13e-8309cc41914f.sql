
-- Add foreign key constraint to link delivery_notes to customers
ALTER TABLE public.delivery_notes 
ADD CONSTRAINT delivery_notes_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES public.customers(id);

-- Also add foreign key constraint for company_id if it doesn't exist
ALTER TABLE public.delivery_notes 
ADD CONSTRAINT delivery_notes_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id);
