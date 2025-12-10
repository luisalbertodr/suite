-- Crear tabla presupuestos_n_items que falta
CREATE TABLE public.presupuestos_n_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  presupuesto_n_id UUID NOT NULL,
  article_id UUID NULL,
  description TEXT NOT NULL,
  quantity NUMERIC NOT NULL DEFAULT 1,
  unit_price NUMERIC NOT NULL DEFAULT 0,
  total_price NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.presupuestos_n_items ENABLE ROW LEVEL SECURITY;

-- Crear políticas RLS para acceso por empresa
CREATE POLICY "Users can access presupuesto_n items"
ON public.presupuestos_n_items
FOR ALL
USING (presupuesto_n_id IN (
  SELECT id FROM presupuestos_n 
  WHERE company_id = get_user_company_id()
));

-- Crear foreign key constraint
ALTER TABLE public.presupuestos_n_items
ADD CONSTRAINT presupuestos_n_items_presupuesto_n_id_fkey
FOREIGN KEY (presupuesto_n_id) REFERENCES public.presupuestos_n(id) ON DELETE CASCADE;

-- Foreign key opcional para artículos
ALTER TABLE public.presupuestos_n_items
ADD CONSTRAINT presupuestos_n_items_article_id_fkey
FOREIGN KEY (article_id) REFERENCES public.articles(id) ON DELETE SET NULL;

-- Trigger para updated_at
CREATE TRIGGER update_presupuestos_n_items_updated_at
  BEFORE UPDATE ON public.presupuestos_n_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para mejor rendimiento
CREATE INDEX idx_presupuestos_n_items_presupuesto_n_id ON public.presupuestos_n_items(presupuesto_n_id);
CREATE INDEX idx_presupuestos_n_items_article_id ON public.presupuestos_n_items(article_id);