
-- Agregar columnas de talla y color a la tabla articles
ALTER TABLE public.articles 
ADD COLUMN talla text,
ADD COLUMN color text;

-- Crear índices para mejorar las consultas por talla y color
CREATE INDEX idx_articles_talla ON public.articles(talla);
CREATE INDEX idx_articles_color ON public.articles(color);

-- Comentarios para documentar las nuevas columnas
COMMENT ON COLUMN public.articles.talla IS 'Talla del artículo (XS, S, M, L, XL, etc.)';
COMMENT ON COLUMN public.articles.color IS 'Color del artículo';
