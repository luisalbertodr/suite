-- Registro diario por cliente, adjuntos, trazas en bono_uso y calidad en bonos.
-- RLS: company_id = get_user_company_id().

CREATE TABLE IF NOT EXISTS public.daily_customer_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies (id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers (id) ON DELETE CASCADE,
  log_date date NOT NULL,
  day_summary text,
  source text NOT NULL DEFAULT 'merged'
    CHECK (source IN ('merged', 'import', 'manual', 'backfill')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, customer_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_customer_log_customer_date
  ON public.daily_customer_log (customer_id, log_date DESC);

CREATE TABLE IF NOT EXISTS public.daily_customer_log_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.daily_customer_log (id) ON DELETE CASCADE,
  item_kind text NOT NULL
    CHECK (item_kind IN (
      'service', 'product', 'bono_use', 'bono_purchase', 'sale',
      'clinic_note', 'aesthetic', 'consent', 'document', 'appointment', 'other'
    )),
  title text,
  body text,
  ref_table text,
  ref_id uuid,
  article_id uuid NULL REFERENCES public.articles (id) ON DELETE SET NULL,
  bono_id uuid NULL REFERENCES public.bonos (id) ON DELETE SET NULL,
  bono_uso_id uuid NULL REFERENCES public.bono_uso (id) ON DELETE SET NULL,
  amount_cents int,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_customer_log_items_log_id
  ON public.daily_customer_log_items (log_id, sort_order);

CREATE TABLE IF NOT EXISTS public.daily_customer_log_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_id uuid NOT NULL REFERENCES public.daily_customer_log (id) ON DELETE CASCADE,
  asset_kind text NOT NULL
    CHECK (asset_kind IN ('photo_before', 'photo_after', 'document', 'consent', 'other')),
  title text,
  storage_path text,
  ref_table text,
  ref_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_customer_log_assets_log_id
  ON public.daily_customer_log_assets (log_id);

ALTER TABLE public.bono_uso
  ADD COLUMN IF NOT EXISTS article_id uuid NULL REFERENCES public.articles (id) ON DELETE SET NULL;
ALTER TABLE public.bono_uso
  ADD COLUMN IF NOT EXISTS quantity numeric(12,3);
ALTER TABLE public.bono_uso
  ADD COLUMN IF NOT EXISTS source_table text;
ALTER TABLE public.bono_uso
  ADD COLUMN IF NOT EXISTS source_legacy_key text;

COMMENT ON COLUMN public.bono_uso.source_table IS
  'Origen: alblin, historial, manual, etc.';
COMMENT ON COLUMN public.bono_uso.source_legacy_key IS
  'Idempotencia/auditoría (clave negocio legacy o id externo).';

ALTER TABLE public.bonos
  ADD COLUMN IF NOT EXISTS data_quality jsonb;

COMMENT ON COLUMN public.bonos.data_quality IS
  'Avisos de importación, contadores dudosos, calidad.';

-- RLS
ALTER TABLE public.daily_customer_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_customer_log_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_customer_log_assets ENABLE ROW LEVEL SECURITY;

DO $pol$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_customer_log'
      AND policyname = 'Users manage daily_customer_log in their company'
  ) THEN
    CREATE POLICY "Users manage daily_customer_log in their company"
    ON public.daily_customer_log
    FOR ALL TO authenticated
    USING (company_id = get_user_company_id())
    WITH CHECK (company_id = get_user_company_id());
  END IF;
END
$pol$;

DO $pol2$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_customer_log_items'
      AND policyname = 'Users manage daily_customer_log_items in their company'
  ) THEN
    CREATE POLICY "Users manage daily_customer_log_items in their company"
    ON public.daily_customer_log_items
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.daily_customer_log d
        WHERE d.id = daily_customer_log_items.log_id
          AND d.company_id = get_user_company_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.daily_customer_log d
        WHERE d.id = daily_customer_log_items.log_id
          AND d.company_id = get_user_company_id()
      )
    );
  END IF;
END
$pol2$;

DO $pol3$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_customer_log_assets'
      AND policyname = 'Users manage daily_customer_log_assets in their company'
  ) THEN
    CREATE POLICY "Users manage daily_customer_log_assets in their company"
    ON public.daily_customer_log_assets
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.daily_customer_log d
        WHERE d.id = daily_customer_log_assets.log_id
          AND d.company_id = get_user_company_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.daily_customer_log d
        WHERE d.id = daily_customer_log_assets.log_id
          AND d.company_id = get_user_company_id()
      )
    );
  END IF;
END
$pol3$;
