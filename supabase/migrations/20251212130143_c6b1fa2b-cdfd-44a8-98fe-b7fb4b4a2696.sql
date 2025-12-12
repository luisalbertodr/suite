-- Add measurements and surface_area columns to quote_items
ALTER TABLE public.quote_items 
ADD COLUMN IF NOT EXISTS measurements text,
ADD COLUMN IF NOT EXISTS surface_area numeric DEFAULT 0;

-- Add iva_percentage and discount_percentage alias columns to invoice_items for code compatibility
-- (Using tax_percent and discount_percent as aliases)
-- Note: The code uses different names, so we add the missing ones
ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS iva_percentage numeric DEFAULT 21,
ADD COLUMN IF NOT EXISTS discount_percentage numeric DEFAULT 0;