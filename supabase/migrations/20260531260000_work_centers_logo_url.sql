-- Logo del centro laboral (barra superior, PDFs, etc.)
ALTER TABLE public.work_centers
  ADD COLUMN IF NOT EXISTS logo_url TEXT;

COMMENT ON COLUMN public.work_centers.logo_url IS
  'Logo del centro de trabajo (data URL o URL pública). Configurable en Apariencia.';
