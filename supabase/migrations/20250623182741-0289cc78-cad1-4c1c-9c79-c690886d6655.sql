
-- Agregar columnas para totalización en delivery_notes
ALTER TABLE public.delivery_notes 
ADD COLUMN subtotal numeric DEFAULT 0 NOT NULL,
ADD COLUMN tax_amount numeric DEFAULT 0 NOT NULL,
ADD COLUMN total_amount numeric DEFAULT 0 NOT NULL;

-- Agregar columna unit_price a delivery_note_items para poder calcular totales
ALTER TABLE public.delivery_note_items 
ADD COLUMN unit_price numeric DEFAULT 0 NOT NULL,
ADD COLUMN total_price numeric DEFAULT 0 NOT NULL;
