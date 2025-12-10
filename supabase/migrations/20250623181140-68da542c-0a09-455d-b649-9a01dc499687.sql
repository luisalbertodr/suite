
-- Agregar columna para marcar presupuestos como facturados
ALTER TABLE public.quotes 
ADD COLUMN invoiced BOOLEAN NOT NULL DEFAULT false;

-- Agregar columna para referenciar la factura que se creó desde el presupuesto
ALTER TABLE public.quotes 
ADD COLUMN invoiced_at TIMESTAMP WITH TIME ZONE;

-- Agregar referencia a la factura en la tabla de presupuestos para trazabilidad
ALTER TABLE public.quotes 
ADD COLUMN invoice_id UUID REFERENCES public.invoices(id);
