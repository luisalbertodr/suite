
-- Create planillas table
CREATE TABLE public.planillas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  supplier_id UUID REFERENCES public.suppliers(id),
  company_id UUID NOT NULL,
  estado TEXT NOT NULL DEFAULT 'activa',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create planilla_items table to store the spreadsheet rows
CREATE TABLE public.planilla_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  planilla_id UUID NOT NULL REFERENCES public.planillas(id) ON DELETE CASCADE,
  articulo TEXT NOT NULL,
  color TEXT NOT NULL,
  precio NUMERIC NOT NULL,
  descripcion TEXT,
  -- Size columns (16-46)
  talla_16 INTEGER DEFAULT 0,
  talla_17 INTEGER DEFAULT 0,
  talla_18 INTEGER DEFAULT 0,
  talla_19 INTEGER DEFAULT 0,
  talla_20 INTEGER DEFAULT 0,
  talla_21 INTEGER DEFAULT 0,
  talla_22 INTEGER DEFAULT 0,
  talla_23 INTEGER DEFAULT 0,
  talla_24 INTEGER DEFAULT 0,
  talla_25 INTEGER DEFAULT 0,
  talla_26 INTEGER DEFAULT 0,
  talla_27 INTEGER DEFAULT 0,
  talla_28 INTEGER DEFAULT 0,
  talla_29 INTEGER DEFAULT 0,
  talla_30 INTEGER DEFAULT 0,
  talla_31 INTEGER DEFAULT 0,
  talla_32 INTEGER DEFAULT 0,
  talla_33 INTEGER DEFAULT 0,
  talla_34 INTEGER DEFAULT 0,
  talla_35 INTEGER DEFAULT 0,
  talla_36 INTEGER DEFAULT 0,
  talla_37 INTEGER DEFAULT 0,
  talla_38 INTEGER DEFAULT 0,
  talla_39 INTEGER DEFAULT 0,
  talla_40 INTEGER DEFAULT 0,
  talla_41 INTEGER DEFAULT 0,
  talla_42 INTEGER DEFAULT 0,
  talla_43 INTEGER DEFAULT 0,
  talla_44 INTEGER DEFAULT 0,
  talla_45 INTEGER DEFAULT 0,
  talla_46 INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create colors table for managing colors separately
CREATE TABLE public.colors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add some default colors
INSERT INTO public.colors (name) VALUES 
('Negro'), ('Blanco'), ('Marrón'), ('Azul'), ('Rojo'), 
('Verde'), ('Gris'), ('Beige'), ('Rosa'), ('Amarillo');

-- Enable RLS on new tables
ALTER TABLE public.planillas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.planilla_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.colors ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for planillas
CREATE POLICY "Users can access their company's planillas" 
ON public.planillas 
FOR ALL 
USING (company_id = get_user_company_id());

-- Create RLS policies for planilla_items
CREATE POLICY "Users can access planilla items" 
ON public.planilla_items 
FOR ALL 
USING (planilla_id IN (
  SELECT id FROM public.planillas WHERE company_id = get_user_company_id()
));

-- Create RLS policies for colors (allow all users to read and add colors)
CREATE POLICY "Users can view all colors" 
ON public.colors 
FOR SELECT 
USING (true);

CREATE POLICY "Users can add new colors" 
ON public.colors 
FOR INSERT 
WITH CHECK (true);

-- Add indexes for better performance
CREATE INDEX idx_planillas_company_id ON public.planillas(company_id);
CREATE INDEX idx_planillas_codigo ON public.planillas(codigo);
CREATE INDEX idx_planilla_items_planilla_id ON public.planilla_items(planilla_id);
CREATE INDEX idx_colors_name ON public.colors(name);

-- Add triggers for updated_at
CREATE TRIGGER update_planillas_updated_at 
  BEFORE UPDATE ON public.planillas 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_planilla_items_updated_at 
  BEFORE UPDATE ON public.planilla_items 
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to generate planilla code
CREATE OR REPLACE FUNCTION public.generate_planilla_code(company_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  next_number INTEGER;
  new_code TEXT;
BEGIN
  -- Lock the table to prevent race conditions
  LOCK TABLE public.planillas IN EXCLUSIVE MODE;
  
  -- Get the highest number for this company
  SELECT COALESCE(
    MAX(
      CAST(
        SUBSTRING(codigo FROM 'PL-(\d+)$') AS INTEGER
      )
    ), 0
  ) + 1
  INTO next_number
  FROM public.planillas
  WHERE planillas.company_id = generate_planilla_code.company_id
    AND codigo ~ '^PL-\d+$';
  
  -- Format the new code
  new_code := 'PL-' || LPAD(next_number::TEXT, 6, '0');
  
  RETURN new_code;
END;
$function$;
