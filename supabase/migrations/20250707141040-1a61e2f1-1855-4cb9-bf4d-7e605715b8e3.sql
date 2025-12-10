
-- Add RE percentage field to customers table if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'customers' AND column_name = 're_percentage') THEN
        ALTER TABLE public.customers ADD COLUMN re_percentage numeric DEFAULT 0;
    END IF;
END $$;

-- Add discount field to invoice_items table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoice_items' AND column_name = 'discount_percentage') THEN
        ALTER TABLE public.invoice_items ADD COLUMN discount_percentage numeric DEFAULT 0;
    END IF;
END $$;

-- Add IVA percentage field to invoice_items table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoice_items' AND column_name = 'iva_percentage') THEN
        ALTER TABLE public.invoice_items ADD COLUMN iva_percentage numeric DEFAULT 21;
    END IF;
END $$;

-- Add RE percentage field to invoice_items table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoice_items' AND column_name = 're_percentage') THEN
        ALTER TABLE public.invoice_items ADD COLUMN re_percentage numeric DEFAULT 0;
    END IF;
END $$;

-- Add subtotal after discount field to invoice_items table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoice_items' AND column_name = 'subtotal_after_discount') THEN
        ALTER TABLE public.invoice_items ADD COLUMN subtotal_after_discount numeric DEFAULT 0;
    END IF;
END $$;

-- Add IVA amount field to invoice_items table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoice_items' AND column_name = 'iva_amount') THEN
        ALTER TABLE public.invoice_items ADD COLUMN iva_amount numeric DEFAULT 0;
    END IF;
END $$;

-- Add RE amount field to invoice_items table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoice_items' AND column_name = 're_amount') THEN
        ALTER TABLE public.invoice_items ADD COLUMN re_amount numeric DEFAULT 0;
    END IF;
END $$;

-- Add RE total field to invoices table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 're_total') THEN
        ALTER TABLE public.invoices ADD COLUMN re_total numeric DEFAULT 0;
    END IF;
END $$;

-- Add is_intracomunitario field to invoices table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'is_intracomunitario') THEN
        ALTER TABLE public.invoices ADD COLUMN is_intracomunitario boolean DEFAULT false;
    END IF;
END $$;
