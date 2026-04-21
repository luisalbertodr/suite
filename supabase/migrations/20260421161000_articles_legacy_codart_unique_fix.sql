-- Corrige el target de ON CONFLICT usado por scripts/promote_legacy_catalog.py
-- Debe existir un índice UNIQUE no parcial sobre (company_id, legacy_codart).

DROP INDEX IF EXISTS public.idx_articles_company_legacy_codart_unique;

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_company_legacy_codart_unique
  ON public.articles (company_id, legacy_codart);
