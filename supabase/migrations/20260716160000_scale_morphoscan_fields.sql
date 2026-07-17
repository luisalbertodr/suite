-- Básculas: dispositivo (InBody / MorphoScan) + métricas extra MorphoScan Nova.
-- Se reutiliza inbody_measurements como tabla unificada de composición corporal.

ALTER TABLE public.inbody_measurements
  ADD COLUMN IF NOT EXISTS device text NOT NULL DEFAULT 'inbody',
  ADD COLUMN IF NOT EXISTS bone_mass_kg numeric,
  ADD COLUMN IF NOT EXISTS protein_mass_kg numeric,
  ADD COLUMN IF NOT EXISTS protein_pct numeric,
  ADD COLUMN IF NOT EXISTS body_water_pct numeric,
  ADD COLUMN IF NOT EXISTS visceral_fat_index numeric,
  ADD COLUMN IF NOT EXISTS subcutaneous_fat_pct numeric,
  ADD COLUMN IF NOT EXISTS metabolic_age numeric,
  ADD COLUMN IF NOT EXISTS smi numeric,
  ADD COLUMN IF NOT EXISTS body_type text,
  ADD COLUMN IF NOT EXISTS heart_rate numeric,
  ADD COLUMN IF NOT EXISTS weight_control_kg numeric,
  ADD COLUMN IF NOT EXISTS target_weight_kg numeric,
  ADD COLUMN IF NOT EXISTS raw_payload jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.inbody_measurements.device IS
  'Marca/dispositivo: inbody | morphoscan';
COMMENT ON COLUMN public.inbody_measurements.bone_mass_kg IS
  'Masa ósea (MorphoScan / básculas con métrica).';
COMMENT ON COLUMN public.inbody_measurements.protein_mass_kg IS
  'Masa proteica (MorphoScan).';
COMMENT ON COLUMN public.inbody_measurements.protein_pct IS
  'Porcentaje de proteína (MorphoScan).';
COMMENT ON COLUMN public.inbody_measurements.body_water_pct IS
  'Porcentaje de agua corporal (MorphoScan).';
COMMENT ON COLUMN public.inbody_measurements.visceral_fat_index IS
  'Índice de grasa visceral (MorphoScan).';
COMMENT ON COLUMN public.inbody_measurements.subcutaneous_fat_pct IS
  'Porcentaje de grasa subcutánea (MorphoScan).';
COMMENT ON COLUMN public.inbody_measurements.metabolic_age IS
  'Edad metabólica (MorphoScan).';
COMMENT ON COLUMN public.inbody_measurements.smi IS
  'Skeletal Muscle Index (MorphoScan).';
COMMENT ON COLUMN public.inbody_measurements.body_type IS
  'Tipo / forma corporal reportada por la báscula.';
COMMENT ON COLUMN public.inbody_measurements.heart_rate IS
  'Frecuencia cardiaca si la báscula la reporta.';
COMMENT ON COLUMN public.inbody_measurements.weight_control_kg IS
  'Control de peso sugerido (MorphoScan).';
COMMENT ON COLUMN public.inbody_measurements.target_weight_kg IS
  'Peso objetivo (MorphoScan).';
COMMENT ON COLUMN public.inbody_measurements.raw_payload IS
  'Payload crudo del puente BLE / app (diagnóstico y campos futuros).';

UPDATE public.inbody_measurements
SET device = 'inbody'
WHERE device IS NULL
   OR device = ''
   OR (device = 'inbody' AND source ILIKE 'lookinbody%');

UPDATE public.inbody_measurements
SET device = 'morphoscan'
WHERE source ILIKE 'morphoscan%';

ALTER TABLE public.inbody_measurements
  DROP CONSTRAINT IF EXISTS inbody_measurements_device_check;

ALTER TABLE public.inbody_measurements
  ADD CONSTRAINT inbody_measurements_device_check
  CHECK (device IN ('inbody', 'morphoscan'));

CREATE INDEX IF NOT EXISTS idx_inbody_measurements_device_measured
  ON public.inbody_measurements (company_id, device, measured_at DESC);

COMMENT ON TABLE public.inbody_measurements IS
  'Mediciones de composición corporal (InBody 270 / MorphoScan Nova). Import CSV/MDB o ingest BLE.';
