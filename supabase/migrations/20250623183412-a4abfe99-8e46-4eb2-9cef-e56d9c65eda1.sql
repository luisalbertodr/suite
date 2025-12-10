
-- Agregar supplier_id a delivery_notes para albaranes de entrada
ALTER TABLE public.delivery_notes 
ADD COLUMN supplier_id uuid REFERENCES public.suppliers(id);

-- Hacer que customer_id sea opcional para albaranes de entrada
ALTER TABLE public.delivery_notes 
ALTER COLUMN customer_id DROP NOT NULL;

-- Agregar restricción para que tenga supplier_id O customer_id
ALTER TABLE public.delivery_notes 
ADD CONSTRAINT check_supplier_or_customer 
CHECK (
  (supplier_id IS NOT NULL AND customer_id IS NULL) OR 
  (supplier_id IS NULL AND customer_id IS NOT NULL)
);

-- Agregar artículo_id a delivery_note_items para poder actualizar stock
ALTER TABLE public.delivery_note_items 
ADD COLUMN article_id uuid REFERENCES public.articles(id);
