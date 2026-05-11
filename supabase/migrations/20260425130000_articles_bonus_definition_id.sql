-- Enlaza el artículo de catálogo (bono) con su plantilla de composición (legacy / editable).
ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS bonus_definition_id UUID NULL
  REFERENCES public.bonus_definitions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_articles_bonus_definition_id
  ON public.articles(bonus_definition_id);
