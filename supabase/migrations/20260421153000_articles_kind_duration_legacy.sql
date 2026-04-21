ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS article_kind text NOT NULL DEFAULT 'producto';

ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS duration_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS legacy_codart text;

ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS legacy_tipart text;

ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS legacy_familia_code text;

ALTER TABLE public.articles
ADD COLUMN IF NOT EXISTS legacy_photo_path text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'articles_article_kind_check'
  ) THEN
    ALTER TABLE public.articles
    ADD CONSTRAINT articles_article_kind_check
      CHECK (article_kind IN ('producto', 'servicio', 'bono'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'articles_duration_minutes_check'
  ) THEN
    ALTER TABLE public.articles
    ADD CONSTRAINT articles_duration_minutes_check
      CHECK (duration_minutes >= 0);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_company_legacy_codart_unique
  ON public.articles (company_id, legacy_codart)
  WHERE legacy_codart IS NOT NULL;
