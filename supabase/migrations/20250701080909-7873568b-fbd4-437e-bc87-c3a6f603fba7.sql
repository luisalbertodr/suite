
-- Agregar el campo iban_account a la tabla customers
ALTER TABLE public.customers 
ADD COLUMN iban_account text;
