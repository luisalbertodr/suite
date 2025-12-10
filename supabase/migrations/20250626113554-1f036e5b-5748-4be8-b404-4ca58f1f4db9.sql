
-- Agregar campos para el estado de pago y fecha de pago en la tabla invoices
ALTER TABLE public.invoices 
ADD COLUMN paid_status boolean NOT NULL DEFAULT false,
ADD COLUMN paid_date timestamp with time zone;

-- Crear índice para mejorar consultas por estado de pago
CREATE INDEX idx_invoices_paid_status ON public.invoices(paid_status);
CREATE INDEX idx_invoices_paid_date ON public.invoices(paid_date);

-- Actualizar el trigger de updated_at si no existe
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';
