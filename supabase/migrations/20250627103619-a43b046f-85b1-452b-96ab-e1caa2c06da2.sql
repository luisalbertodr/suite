
-- Agregar columna tipo_producto a la tabla articles
ALTER TABLE public.articles 
ADD COLUMN tipo_producto text NOT NULL DEFAULT 'standard';

-- Crear constraint para validar los valores permitidos
ALTER TABLE public.articles 
ADD CONSTRAINT articles_tipo_producto_check 
CHECK (tipo_producto IN ('textil', 'calzado', 'standard'));

-- Crear índice para mejorar las consultas por tipo de producto
CREATE INDEX idx_articles_tipo_producto ON public.articles(tipo_producto);

-- Comentario para documentar la nueva columna
COMMENT ON COLUMN public.articles.tipo_producto IS 'Tipo de producto: textil, calzado o standard';
