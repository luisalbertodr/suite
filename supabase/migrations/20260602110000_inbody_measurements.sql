-- Mediciones InBody / Lookin'Body vinculadas a clientes.
-- Importación inicial desde LookinBody30.mdb; futuras actualizaciones vía CSV.

CREATE TABLE public.inbody_measurements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  inbody_user_id text NOT NULL,
  measured_at timestamptz NOT NULL,

  height_cm numeric,
  age_years numeric,
  sex text,

  weight_kg numeric,
  weight_min_kg numeric,
  weight_max_kg numeric,
  smm_kg numeric,
  smm_min_kg numeric,
  smm_max_kg numeric,
  body_fat_kg numeric,
  body_fat_min_kg numeric,
  body_fat_max_kg numeric,
  tbw_kg numeric,
  tbw_min_kg numeric,
  tbw_max_kg numeric,
  ffm_kg numeric,
  ffm_min_kg numeric,
  ffm_max_kg numeric,
  slm_kg numeric,

  bmi numeric,
  bmi_min numeric,
  bmi_max numeric,
  pbf_pct numeric,
  pbf_min_pct numeric,
  pbf_max_pct numeric,
  whr numeric,
  whr_min numeric,
  whr_max numeric,
  bmr_kcal numeric,
  bmr_min_kcal numeric,
  bmr_max_kcal numeric,

  fat_control_kg numeric,
  muscle_control_kg numeric,

  segmental_lean jsonb NOT NULL DEFAULT '{}'::jsonb,
  segmental_fat jsonb NOT NULL DEFAULT '{}'::jsonb,
  impedance jsonb NOT NULL DEFAULT '{}'::jsonb,
  edema jsonb NOT NULL DEFAULT '{}'::jsonb,

  bca jsonb NOT NULL DEFAULT '{}'::jsonb,
  mfa jsonb NOT NULL DEFAULT '{}'::jsonb,
  lb jsonb NOT NULL DEFAULT '{}'::jsonb,
  wc jsonb NOT NULL DEFAULT '{}'::jsonb,
  imp jsonb NOT NULL DEFAULT '{}'::jsonb,
  ed jsonb NOT NULL DEFAULT '{}'::jsonb,

  source text NOT NULL DEFAULT 'lookinbody_mdb',
  import_batch text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT inbody_measurements_company_user_measured_unique
    UNIQUE (company_id, inbody_user_id, measured_at)
);

CREATE INDEX idx_inbody_measurements_customer_measured
  ON public.inbody_measurements (customer_id, measured_at DESC);

CREATE INDEX idx_inbody_measurements_company_user
  ON public.inbody_measurements (company_id, inbody_user_id);

CREATE INDEX idx_inbody_measurements_measured_at
  ON public.inbody_measurements (measured_at DESC);

ALTER TABLE public.inbody_measurements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage inbody_measurements"
  ON public.inbody_measurements
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

COMMENT ON TABLE public.inbody_measurements IS
  'Mediciones de composición corporal InBody 270 (Lookin''Body). Import MDB/CSV.';
