-- Peticiones "Pesar ahora": preselección de cliente esperando medición MorphoScan vía BLE.

CREATE TABLE IF NOT EXISTS public.scale_weigh_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'fulfilled', 'cancelled', 'expired')),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  fulfilled_at timestamptz,
  measurement_id uuid REFERENCES public.inbody_measurements(id) ON DELETE SET NULL,
  matched_weight_kg numeric,
  notes text
);

COMMENT ON TABLE public.scale_weigh_requests IS
  'Preselección de cliente para vincular la siguiente medición MorphoScan (puente BLE → scale-ingest).';

CREATE INDEX IF NOT EXISTS idx_scale_weigh_requests_open
  ON public.scale_weigh_requests (company_id, status, expires_at DESC)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS idx_scale_weigh_requests_customer
  ON public.scale_weigh_requests (customer_id, created_at DESC);

ALTER TABLE public.scale_weigh_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can manage scale_weigh_requests"
  ON public.scale_weigh_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scale_weigh_requests TO authenticated;
GRANT ALL ON public.scale_weigh_requests TO service_role;
