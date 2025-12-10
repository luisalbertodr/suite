
-- Create a function to generate invoice numbers safely
CREATE OR REPLACE FUNCTION public.generate_invoice_number(company_id uuid, prefix text)
RETURNS text AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  -- Lock the table to prevent race conditions
  LOCK TABLE public.invoices IN EXCLUSIVE MODE;
  
  -- Get the highest number for this company and prefix
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(number FROM (prefix || '-(\d+)$')) AS INTEGER
      )
    ), 0
  ) + 1
  INTO next_number
  FROM public.invoices
  WHERE invoices.company_id = generate_invoice_number.company_id
    AND number ~ ('^' || prefix || '-\d+$');
  
  -- Format the new number
  new_number := prefix || '-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
