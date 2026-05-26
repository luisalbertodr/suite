-- Recurso exclusivo por artículo (servicio) e asignación por ítem de cita.

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS recurso_id uuid REFERENCES public.recursos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_articles_recurso_id ON public.articles(recurso_id);

ALTER TABLE public.appointment_items
  ADD COLUMN IF NOT EXISTS cabina_id uuid REFERENCES public.cabinas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recurso_id uuid REFERENCES public.recursos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_appointment_items_cabina_id ON public.appointment_items(cabina_id);
CREATE INDEX IF NOT EXISTS idx_appointment_items_recurso_id ON public.appointment_items(recurso_id);
