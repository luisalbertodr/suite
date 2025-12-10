
-- Eliminar las columnas talla y color de la tabla articles ya que ahora solo se usarán en las variaciones
ALTER TABLE public.articles 
DROP COLUMN IF EXISTS talla,
DROP COLUMN IF EXISTS color;

-- Eliminar los índices que se crearon para estas columnas
DROP INDEX IF EXISTS idx_articles_talla;
DROP INDEX IF EXISTS idx_articles_color;
