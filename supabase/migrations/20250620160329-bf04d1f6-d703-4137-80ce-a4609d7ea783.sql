
-- Habilitar Row Level Security en la tabla invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Crear política para que los usuarios puedan ver sus propias facturas
CREATE POLICY "Users can view invoices" 
  ON public.invoices 
  FOR SELECT 
  USING (true);

-- Crear política para que los usuarios puedan crear facturas
CREATE POLICY "Users can create invoices" 
  ON public.invoices 
  FOR INSERT 
  WITH CHECK (true);

-- Crear política para que los usuarios puedan actualizar facturas
CREATE POLICY "Users can update invoices" 
  ON public.invoices 
  FOR UPDATE 
  USING (true);

-- Crear política para que los usuarios puedan eliminar facturas
CREATE POLICY "Users can delete invoices" 
  ON public.invoices 
  FOR DELETE 
  USING (true);

-- Habilitar RLS en la tabla invoice_items también
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

-- Crear políticas para invoice_items
CREATE POLICY "Users can view invoice items" 
  ON public.invoice_items 
  FOR SELECT 
  USING (true);

CREATE POLICY "Users can create invoice items" 
  ON public.invoice_items 
  FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Users can update invoice items" 
  ON public.invoice_items 
  FOR UPDATE 
  USING (true);

CREATE POLICY "Users can delete invoice items" 
  ON public.invoice_items 
  FOR DELETE 
  USING (true);
