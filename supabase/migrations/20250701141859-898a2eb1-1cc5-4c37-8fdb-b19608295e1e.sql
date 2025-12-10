
-- Add variation_id column to invoice_items table
ALTER TABLE public.invoice_items 
ADD COLUMN variation_id uuid REFERENCES public.article_variations(id);

-- Add variation_id column to sale_items table
ALTER TABLE public.sale_items 
ADD COLUMN variation_id uuid REFERENCES public.article_variations(id);

-- Add variation_id column to quote_items table (for consistency)
ALTER TABLE public.quote_items 
ADD COLUMN variation_id uuid REFERENCES public.article_variations(id);

-- Add variation_id column to delivery_note_items table (for consistency)
ALTER TABLE public.delivery_note_items 
ADD COLUMN variation_id uuid REFERENCES public.delivery_note_items(id);

-- Create index for better performance
CREATE INDEX idx_invoice_items_variation_id ON public.invoice_items(variation_id);
CREATE INDEX idx_sale_items_variation_id ON public.sale_items(variation_id);
CREATE INDEX idx_quote_items_variation_id ON public.quote_items(variation_id);
CREATE INDEX idx_delivery_note_items_variation_id ON public.delivery_note_items(variation_id);
