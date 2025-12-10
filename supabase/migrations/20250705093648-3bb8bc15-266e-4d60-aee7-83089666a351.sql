
-- Fix the generate_quote_number function to properly handle company-specific numbering
CREATE OR REPLACE FUNCTION public.generate_quote_number(company_id uuid, prefix text)
RETURNS text AS $$
DECLARE
  next_number INTEGER;
  new_number TEXT;
BEGIN
  -- Lock the table to prevent race conditions
  LOCK TABLE public.quotes IN EXCLUSIVE MODE;
  
  -- Get the highest number for this specific company and prefix
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(number FROM ('^' || prefix || '-(\d+)$')) AS INTEGER
      )
    ), 0
  ) + 1
  INTO next_number
  FROM public.quotes
  WHERE quotes.company_id = generate_quote_number.company_id
    AND number ~ ('^' || regexp_escape(prefix) || '-\d+$');
  
  -- Format the new number with 6-digit padding
  new_number := prefix || '-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_number;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
