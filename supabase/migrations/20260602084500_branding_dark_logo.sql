ALTER TABLE public.work_centers
  ADD COLUMN IF NOT EXISTS logo_url_dark text;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS logo_url_dark text;
