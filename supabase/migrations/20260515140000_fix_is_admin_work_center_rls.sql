-- Repara entornos donde 20260515120000 falló por falta de is_admin().
-- Idempotente: crea la función y reaplica RLS/triggers de centro laboral.

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

-- RLS work_centers (solo si la tabla existe)
DO $$
BEGIN
  IF to_regclass('public.work_centers') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.work_centers ENABLE ROW LEVEL SECURITY;

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
END
$$;

-- RLS companies hermanas del centro
DO $$
BEGIN
  IF to_regprocedure('public.company_in_user_work_center(uuid)') IS NULL THEN
    RETURN;
  END IF;

  DROP POLICY IF EXISTS "Users can view work center sibling companies" ON public.companies;
  CREATE POLICY "Users can view work center sibling companies"
    ON public.companies FOR SELECT
    USING (
      id = public.get_user_company_id()
      OR public.company_in_user_work_center(id)
      OR public.is_admin()
    );
END
$$;

-- RLS sale_groups
DO $$
BEGIN
  IF to_regclass('public.sale_groups') IS NULL THEN
    RETURN;
  END IF;

  ALTER TABLE public.sale_groups ENABLE ROW LEVEL SECURITY;

  DROP POLICY IF EXISTS "Users can access their sale groups" ON public.sale_groups;
  CREATE POLICY "Users can access their sale groups"
    ON public.sale_groups FOR ALL
    USING (host_company_id = public.get_user_company_id())
    WITH CHECK (host_company_id = public.get_user_company_id());
END
$$;

-- RLS sales ampliado
DO $$
BEGIN
  IF to_regclass('public.sales') IS NULL THEN
    RETURN;
  END IF;
  IF to_regprocedure('public.company_in_user_work_center(uuid)') IS NULL THEN
    RETURN;
  END IF;

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
      company_id = public.get_user_company_id()
      OR (
        host_company_id = public.get_user_company_id()
        AND public.company_in_user_work_center(company_id)
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
END
$$;

-- Triggers updated_at
DO $$
BEGIN
  IF to_regclass('public.sale_groups') IS NOT NULL
     AND to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_sale_groups_updated_at ON public.sale_groups;
    CREATE TRIGGER update_sale_groups_updated_at
      BEFORE UPDATE ON public.sale_groups
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  IF to_regclass('public.work_centers') IS NOT NULL
     AND to_regprocedure('public.update_updated_at_column()') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS update_work_centers_updated_at ON public.work_centers;
    CREATE TRIGGER update_work_centers_updated_at
      BEFORE UPDATE ON public.work_centers
      FOR EACH ROW
      EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END
$$;
