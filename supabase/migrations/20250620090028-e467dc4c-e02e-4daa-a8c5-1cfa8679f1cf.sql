
-- Add foreign key constraint to link quotes to customers
ALTER TABLE public.quotes 
ADD CONSTRAINT quotes_customer_id_fkey 
FOREIGN KEY (customer_id) REFERENCES public.customers(id);

-- Also add foreign key constraint for company_id if it doesn't exist
ALTER TABLE public.quotes 
ADD CONSTRAINT quotes_company_id_fkey 
FOREIGN KEY (company_id) REFERENCES public.companies(id);
