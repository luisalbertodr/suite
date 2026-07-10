-- Caché de consultas de facturación del dashboard (evita recalcular rangos repetidos).

CREATE TABLE IF NOT EXISTS public.dashboard_billing_query_cache (
  cache_key    text PRIMARY KEY,
  company_id   uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  payload      jsonb NOT NULL,
  computed_at  timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_dashboard_billing_query_cache_company
  ON public.dashboard_billing_query_cache (company_id);

CREATE INDEX IF NOT EXISTS idx_dashboard_billing_query_cache_expires
  ON public.dashboard_billing_query_cache (expires_at);

ALTER TABLE public.dashboard_billing_query_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dashboard_billing_cache_select" ON public.dashboard_billing_query_cache;
CREATE POLICY "dashboard_billing_cache_select"
  ON public.dashboard_billing_query_cache
  FOR SELECT
  TO authenticated
  USING (company_id = public.get_user_company_id());

DROP POLICY IF EXISTS "dashboard_billing_cache_write" ON public.dashboard_billing_query_cache;
CREATE POLICY "dashboard_billing_cache_write"
  ON public.dashboard_billing_query_cache
  FOR ALL
  TO authenticated
  USING (company_id = public.get_user_company_id())
  WITH CHECK (company_id = public.get_user_company_id());

COMMENT ON TABLE public.dashboard_billing_query_cache IS
  'Resultados cacheados de facturación dashboard (mensual/diaria) con TTL.';
