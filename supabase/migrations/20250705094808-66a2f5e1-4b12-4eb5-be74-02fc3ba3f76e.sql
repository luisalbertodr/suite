
-- Remove the existing unique constraint on the number column
ALTER TABLE public.quotes DROP CONSTRAINT IF EXISTS quotes_number_key;

-- Add a new unique constraint that combines number and company_id
-- This allows the same quote number to exist for different companies
ALTER TABLE public.quotes ADD CONSTRAINT quotes_number_company_unique UNIQUE (number, company_id);
