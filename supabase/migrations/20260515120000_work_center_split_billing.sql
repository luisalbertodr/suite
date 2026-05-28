-- Centro Laboral: multi-empresa fiscal bajo un mismo tenant operativo
-- Permite facturación dividida (split billing) sin romper centros mono-empresa

-- ---------------------------------------------------------------------------
-- 1. Centros laborales
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.work_centers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_centers ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- 2. Extensión de companies
-- ---------------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS work_center_id UUID REFERENCES public.work_centers(id) ON DELETE SET NULL;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS tpv_ticket_prefix TEXT;

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS short_name TEXT;

COMMENT ON COLUMN public.companies.work_center_id IS
  'Agrupa empresas legales que comparten centro laboral (agenda, clientes, TPV). NULL = mono-empresa.';
COMMENT ON COLUMN public.companies.tpv_ticket_prefix IS
  'Prefijo de serie TPV (ej. M, SL). NULL = formato TPV-000001 estándar.';
COMMENT ON COLUMN public.companies.short_name IS
  'Nombre corto para UI de cobro dividido.';

-- ---------------------------------------------------------------------------
-- 3. Empresa emisora por familia / artículo / empleado
-- ---------------------------------------------------------------------------
ALTER TABLE public.article_families
  ADD COLUMN IF NOT EXISTS billing_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.articles
  ADD COLUMN IF NOT EXISTS billing_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.agenda_employees
  ADD COLUMN IF NOT EXISTS billing_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.article_families.billing_company_id IS
  'Empresa que factura los artículos de esta familia. NULL = empresa del tenant (company_id).';
COMMENT ON COLUMN public.articles.billing_company_id IS
  'Override de empresa emisora. NULL = hereda de familia o company_id del artículo.';
COMMENT ON COLUMN public.agenda_employees.billing_company_id IS
  'Empresa contratante del empleado. NULL = empresa del tenant.';

-- ---------------------------------------------------------------------------
-- 4. Grupos de venta (checkout dividido)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.sale_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  host_company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  customer_name TEXT,
  appointment_id UUID REFERENCES public.agenda_appointments(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'partial', 'completed', 'cancelled')),
  total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_groups_host_company ON public.sale_groups(host_company_id);
CREATE INDEX IF NOT EXISTS idx_sale_groups_appointment ON public.sale_groups(appointment_id);
CREATE INDEX IF NOT EXISTS idx_sale_groups_status ON public.sale_groups(status);

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS sale_group_id UUID REFERENCES public.sale_groups(id) ON DELETE SET NULL;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS host_company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_sale_group ON public.sales(sale_group_id);
CREATE INDEX IF NOT EXISTS idx_sales_host_company ON public.sales(host_company_id);

-- Backfill: ventas existentes = host = company_id (sin auditoría masiva)
ALTER TABLE public.sales DISABLE TRIGGER tr_audit_sales;

UPDATE public.sales
SET host_company_id = company_id
WHERE host_company_id IS NULL
  AND company_id IS NOT NULL;

ALTER TABLE public.sales ENABLE TRIGGER tr_audit_sales;

-- ---------------------------------------------------------------------------
-- 5. Funciones auxiliares multi-centro
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_work_center_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.work_center_id
  FROM public.user_profiles up
  JOIN public.companies c ON c.id = up.company_id
  WHERE up.user_id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.company_in_user_work_center(target_company_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN target_company_id IS NULL THEN false
    WHEN target_company_id = public.get_user_company_id() THEN true
    ELSE EXISTS (
      SELECT 1
      FROM public.companies host
      JOIN public.companies target ON target.id = target_company_id
      WHERE host.id = public.get_user_company_id()
        AND host.work_center_id IS NOT NULL
        AND host.work_center_id = target.work_center_id
    )
  END;
$$;

CREATE OR REPLACE FUNCTION public.get_work_center_billing_companies()
RETURNS SETOF UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id
  FROM public.companies c
  WHERE c.id = public.get_user_company_id()
     OR (
       public.get_user_work_center_id() IS NOT NULL
       AND c.work_center_id = public.get_user_work_center_id()
     );
$$;

-- ---------------------------------------------------------------------------
-- 6. Numeración TPV con prefijo por empresa (M-2026-000001 / SL-2026-000001)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_ticket_number(company_uuid UUID)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  prefix TEXT;
  year_part TEXT;
  next_number INTEGER;
  ticket_num TEXT;
  max_attempts INTEGER := 10;
  attempt INTEGER := 0;
  pattern TEXT;
BEGIN
  SELECT COALESCE(NULLIF(TRIM(tpv_ticket_prefix), ''), NULL)
  INTO prefix
  FROM public.companies
  WHERE id = company_uuid;

  year_part := EXTRACT(YEAR FROM NOW())::TEXT;

  LOOP
    LOCK TABLE public.sales IN EXCLUSIVE MODE;

    IF prefix IS NOT NULL THEN
      pattern := '^' || prefix || '-' || year_part || '-(\d+)$';
      SELECT COALESCE(
        MAX(CAST(SUBSTRING(ticket_number FROM pattern) AS INTEGER)), 0
      ) + 1
      INTO next_number
      FROM public.sales
      WHERE ticket_number ~ pattern
        AND company_id = company_uuid;

      ticket_num := prefix || '-' || year_part || '-' || LPAD(next_number::TEXT, 6, '0');
    ELSE
      SELECT COALESCE(
        MAX(CAST(SUBSTRING(ticket_number FROM '^TPV-(\d+)$') AS INTEGER)), 0
      ) + 1
      INTO next_number
      FROM public.sales
      WHERE ticket_number ~ '^TPV-\d+$'
        AND company_id = company_uuid;

      ticket_num := 'TPV-' || LPAD(next_number::TEXT, 6, '0');
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.sales
      WHERE ticket_number = ticket_num AND company_id = company_uuid
    ) THEN
      RETURN ticket_num;
    END IF;

    attempt := attempt + 1;
    IF attempt >= max_attempts THEN
      ticket_num := ticket_num || '-' || EXTRACT(EPOCH FROM NOW())::INTEGER;
      RETURN ticket_num;
    END IF;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- 6b. Helper is_admin (compat user_roles + user_company_roles + superuser)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF to_regclass('public.user_roles') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role::text IN ('admin', 'superuser')
    ) THEN
      RETURN true;
    END IF;
  END IF;

  IF to_regclass('public.user_company_roles') IS NOT NULL
     AND to_regclass('public.roles') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.user_company_roles ucr
      JOIN public.roles r ON r.id = ucr.role_id
      WHERE ucr.user_id = auth.uid()
        AND ucr.company_id = public.get_user_company_id()
        AND lower(r.name) IN ('admin', 'superuser')
    ) THEN
      RETURN true;
    END IF;
  END IF;

  IF to_regprocedure('public.current_user_is_superuser()') IS NOT NULL THEN
    IF public.current_user_is_superuser() THEN
      RETURN true;
    END IF;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 7. RLS: work_centers
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view their work center" ON public.work_centers;
CREATE POLICY "Users can view their work center"
  ON public.work_centers FOR SELECT
  USING (
    id = public.get_user_work_center_id()
    OR public.is_admin()
  );

DROP POLICY IF EXISTS "Admins can manage work centers" ON public.work_centers;
CREATE POLICY "Admins can manage work centers"
  ON public.work_centers FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------------
-- 8. RLS: companies del mismo centro laboral (lectura)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view work center sibling companies" ON public.companies;
CREATE POLICY "Users can view work center sibling companies"
  ON public.companies FOR SELECT
  USING (
    id = public.get_user_company_id()
    OR public.company_in_user_work_center(id)
    OR public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- 9. RLS: sale_groups
-- ---------------------------------------------------------------------------
ALTER TABLE public.sale_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can access their sale groups" ON public.sale_groups;
CREATE POLICY "Users can access their sale groups"
  ON public.sale_groups FOR ALL
  USING (host_company_id = public.get_user_company_id())
  WITH CHECK (host_company_id = public.get_user_company_id());

-- ---------------------------------------------------------------------------
-- 10. RLS: sales — ampliar para ventas de empresas hermanas del centro
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view sales in their company" ON public.sales;
DROP POLICY IF EXISTS "Users can insert sales in their company" ON public.sales;
DROP POLICY IF EXISTS "Users can update sales in their company" ON public.sales;
DROP POLICY IF EXISTS "Users can delete sales in their company" ON public.sales;
DROP POLICY IF EXISTS "Users can access their company's sales" ON public.sales;

CREATE POLICY "Users can view sales in their company"
  ON public.sales FOR SELECT
  USING (
    company_id = public.get_user_company_id()
    OR host_company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can insert sales in their company"
  ON public.sales FOR INSERT
  WITH CHECK (
    (
      company_id = public.get_user_company_id()
      OR (
        host_company_id = public.get_user_company_id()
        AND public.company_in_user_work_center(company_id)
      )
    )
  );

CREATE POLICY "Users can update sales in their company"
  ON public.sales FOR UPDATE
  USING (
    company_id = public.get_user_company_id()
    OR host_company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can delete sales in their company"
  ON public.sales FOR DELETE
  USING (
    company_id = public.get_user_company_id()
    OR host_company_id = public.get_user_company_id()
  );

-- ---------------------------------------------------------------------------
-- 11. Trigger updated_at sale_groups
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS update_sale_groups_updated_at ON public.sale_groups;
CREATE TRIGGER update_sale_groups_updated_at
  BEFORE UPDATE ON public.sale_groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_work_centers_updated_at ON public.work_centers;
CREATE TRIGGER update_work_centers_updated_at
  BEFORE UPDATE ON public.work_centers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
