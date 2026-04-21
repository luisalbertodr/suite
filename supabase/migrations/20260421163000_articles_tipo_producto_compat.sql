-- Compatibiliza tipo_producto para catálogo nuevo + histórico.
-- Actualmente la BD de destino permite solo servicio/producto.

ALTER TABLE public.articles
DROP CONSTRAINT IF EXISTS articles_tipo_producto_check;

ALTER TABLE public.articles
ADD CONSTRAINT articles_tipo_producto_check
CHECK (
  tipo_producto IN (
    'producto',
    'servicio',
    'PRODUCTO',
    'SERVICIO',
    'standard',
    'textil',
    'calzado'
  )
);
