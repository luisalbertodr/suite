-- Color de agenda y palabras clave para detectar recurso por nombre de servicio
ALTER TABLE public.recursos
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#3B82F6',
  ADD COLUMN IF NOT EXISTS match_keywords TEXT;

COMMENT ON COLUMN public.recursos.color IS 'Color hex (#RRGGBB) para tramos de agenda asociados a este recurso.';
COMMENT ON COLUMN public.recursos.match_keywords IS 'Palabras clave separadas por coma para detectar el recurso en el nombre del servicio (ej. ipl,laser,lumbar).';
