
-- Eliminar el constraint único actual en la columna number
ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_number_key;

-- Crear un constraint único compuesto que permita el mismo número para diferentes empresas
ALTER TABLE public.invoices ADD CONSTRAINT invoices_number_company_unique UNIQUE (number, company_id);
