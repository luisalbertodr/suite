-- Snapshot de perfil antropométrico en la petición "Pesar ahora"
-- para que el bridge BLE (MorphoScan) use altura/edad/sexo del paciente
-- en el handshake BIA, no el perfil genérico de config.yaml.

ALTER TABLE public.scale_weigh_requests
  ADD COLUMN IF NOT EXISTS height_cm numeric,
  ADD COLUMN IF NOT EXISTS age_years integer,
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS profile_name text;

COMMENT ON COLUMN public.scale_weigh_requests.height_cm IS
  'Altura (cm) enviada al bridge para BIA en el momento de abrir la petición.';
COMMENT ON COLUMN public.scale_weigh_requests.age_years IS
  'Edad (años) enviada al bridge para BIA.';
COMMENT ON COLUMN public.scale_weigh_requests.sex IS
  'Sexo M/F enviado al bridge para BIA.';
COMMENT ON COLUMN public.scale_weigh_requests.profile_name IS
  'Nombre corto del paciente para el frame de perfil de la báscula.';
