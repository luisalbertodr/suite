-- Create PresupuestosN tables and functions

-- Create the presupuestos_n table
CREATE TABLE public.presupuestos_n (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES public.companies(id),
  customer_id UUID NOT NULL REFERENCES public.customers(id),
  number TEXT NOT NULL,
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  accepted_date TIMESTAMP WITH TIME ZONE,
  status TEXT NOT NULL DEFAULT 'borrador',
  subtotal NUMERIC NOT NULL DEFAULT 0,
  tax_amount NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, number)
);

-- Create the presupuestos_n_items table
CREATE TABLE public.presupuestos_n_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  presupuesto_n_id UUID NOT NULL REFERENCES public.presupuestos_n(id) ON DELETE CASCADE,
  article_id UUID REFERENCES public.articles(id),
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on both tables
ALTER TABLE public.presupuestos_n ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presupuestos_n_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for presupuestos_n
CREATE POLICY "Users can access their company's presupuestos_n"
ON public.presupuestos_n
FOR ALL
USING (company_id = get_user_company_id());

-- Create RLS policies for presupuestos_n_items
CREATE POLICY "Users can access presupuestos_n items"
ON public.presupuestos_n_items
FOR ALL
USING (presupuesto_n_id IN (
  SELECT id FROM public.presupuestos_n
  WHERE company_id = get_user_company_id()
));

-- Create function to generate presupuesto_n number with annual reset
CREATE OR REPLACE FUNCTION public.generate_presupuesto_n_number(company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_year TEXT;
  next_number INTEGER;
  new_number TEXT;
BEGIN
  -- Get current year
  current_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  
  -- Lock the table to prevent race conditions
  LOCK TABLE public.presupuestos_n IN EXCLUSIVE MODE;
  
  -- Get the highest number for this company and current year
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(number FROM ('PRES-' || current_year || '-(\d+)$')) AS INTEGER
      )
    ), 0
  ) + 1
  INTO next_number
  FROM public.presupuestos_n
  WHERE presupuestos_n.company_id = generate_presupuesto_n_number.company_id
    AND number ~ ('^PRES-' || current_year || '-\d+$');
  
  -- Format the new number with 7-digit padding
  new_number := 'PRES-' || current_year || '-' || LPAD(next_number::TEXT, 7, '0');
  
  RETURN new_number;
END;
$$;

-- Create trigger to update updated_at column
CREATE TRIGGER update_presupuestos_n_updated_at
BEFORE UPDATE ON public.presupuestos_n
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create trigger to automatically set accepted_date when status changes to 'aceptado'
CREATE OR REPLACE FUNCTION public.set_accepted_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If status is changing to 'aceptado' and accepted_date is null
  IF NEW.status = 'aceptado' AND OLD.status != 'aceptado' AND NEW.accepted_date IS NULL THEN
    NEW.accepted_date = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_presupuesto_n_accepted_date
BEFORE UPDATE ON public.presupuestos_n
FOR EACH ROW
EXECUTE FUNCTION public.set_accepted_date();