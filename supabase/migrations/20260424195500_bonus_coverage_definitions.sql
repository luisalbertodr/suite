-- Estructura para cobertura de bonos por servicio/producto.
-- Permite definir cuántas sesiones/unidades cubre cada bono.

CREATE TABLE IF NOT EXISTS public.bonus_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  default_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  default_total_sessions INTEGER NOT NULL DEFAULT 1,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE IF NOT EXISTS public.bonus_definition_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  definition_id UUID NOT NULL REFERENCES public.bonus_definitions(id) ON DELETE CASCADE,
  coverage_type TEXT NOT NULL CHECK (coverage_type IN ('service', 'product', 'family')),
  article_id UUID NULL REFERENCES public.articles(id) ON DELETE SET NULL,
  family_code TEXT NULL,
  covered_quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  notes TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bonus_definition_items_definition_id
  ON public.bonus_definition_items(definition_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'bonos'
  ) THEN
    ALTER TABLE public.bonos
      ADD COLUMN IF NOT EXISTS bonus_definition_id UUID NULL REFERENCES public.bonus_definitions(id) ON DELETE SET NULL;
    ALTER TABLE public.bonos
      ADD COLUMN IF NOT EXISTS coverage_items JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'customer_vouchers'
  ) THEN
    ALTER TABLE public.customer_vouchers
      ADD COLUMN IF NOT EXISTS bonus_definition_id UUID NULL REFERENCES public.bonus_definitions(id) ON DELETE SET NULL;
    ALTER TABLE public.customer_vouchers
      ADD COLUMN IF NOT EXISTS coverage_items JSONB NOT NULL DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- RLS
ALTER TABLE public.bonus_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bonus_definition_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bonus_definitions'
      AND policyname = 'Users can manage bonus definitions in their company'
  ) THEN
    CREATE POLICY "Users can manage bonus definitions in their company"
    ON public.bonus_definitions
    FOR ALL TO authenticated
    USING (company_id = get_user_company_id())
    WITH CHECK (company_id = get_user_company_id());
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bonus_definition_items'
      AND policyname = 'Users can read bonus definition items in their company'
  ) THEN
    CREATE POLICY "Users can read bonus definition items in their company"
    ON public.bonus_definition_items
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.bonus_definitions d
        WHERE d.id = bonus_definition_items.definition_id
          AND d.company_id = get_user_company_id()
      )
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'bonus_definition_items'
      AND policyname = 'Users can manage bonus definition items in their company'
  ) THEN
    CREATE POLICY "Users can manage bonus definition items in their company"
    ON public.bonus_definition_items
    FOR ALL TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.bonus_definitions d
        WHERE d.id = bonus_definition_items.definition_id
          AND d.company_id = get_user_company_id()
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1
        FROM public.bonus_definitions d
        WHERE d.id = bonus_definition_items.definition_id
          AND d.company_id = get_user_company_id()
      )
    );
  END IF;
END $$;
