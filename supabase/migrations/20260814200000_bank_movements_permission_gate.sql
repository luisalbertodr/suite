-- Pestaña Movimientos bancarios: solo admin/manager/superadmin por defecto.
-- Usuarios autorizados explícitamente solo ven la(s) empresa(s) donde tengan el permiso.

INSERT INTO public.permissions (resource, action, name, description) VALUES
  (
    'bank_movements',
    'read',
    'Movimientos bancarios',
    'Ver e importar movimientos bancarios (gastos) en Facturación. Por defecto solo admin.'
  )
ON CONFLICT (resource, action) DO UPDATE
  SET name = EXCLUDED.name,
      description = COALESCE(EXCLUDED.description, public.permissions.description);

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM public.roles r
CROSS JOIN public.permissions p
WHERE lower(r.name) IN ('admin', 'manager', 'superadmin')
  AND p.resource = 'bank_movements'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;

-- RLS: acceso a filas solo con permiso efectivo en esa empresa (+ superuser/admin).
DROP POLICY IF EXISTS "Users can view bank_movements in work center" ON public.bank_movements;
DROP POLICY IF EXISTS "Users can insert bank_movements in work center" ON public.bank_movements;
DROP POLICY IF EXISTS "Users can update bank_movements in work center" ON public.bank_movements;
DROP POLICY IF EXISTS "Users can delete bank_movements in work center" ON public.bank_movements;

CREATE OR REPLACE FUNCTION public.user_can_access_bank_movements(p_company_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  IF to_regprocedure('public.current_user_is_superuser()') IS NOT NULL
     AND public.current_user_is_superuser() THEN
    RETURN true;
  END IF;

  IF NOT (
    p_company_id = public.get_user_company_id()
    OR public.user_can_access_company(p_company_id)
    OR public.company_in_user_work_center(p_company_id)
  ) THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM public.get_effective_user_permissions(auth.uid(), p_company_id) ep
    WHERE ep.resource = 'bank_movements'
      AND ep.action = 'read'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_bank_movements(uuid)
  TO authenticated, service_role;

CREATE POLICY "bank_movements_select_permission"
  ON public.bank_movements FOR SELECT TO authenticated
  USING (public.user_can_access_bank_movements(company_id));

CREATE POLICY "bank_movements_insert_permission"
  ON public.bank_movements FOR INSERT TO authenticated
  WITH CHECK (public.user_can_access_bank_movements(company_id));

CREATE POLICY "bank_movements_update_permission"
  ON public.bank_movements FOR UPDATE TO authenticated
  USING (public.user_can_access_bank_movements(company_id))
  WITH CHECK (public.user_can_access_bank_movements(company_id));

CREATE POLICY "bank_movements_delete_permission"
  ON public.bank_movements FOR DELETE TO authenticated
  USING (public.user_can_access_bank_movements(company_id));

-- RPCs de gastos: respetar el mismo permiso por empresa.
CREATE OR REPLACE FUNCTION public.dashboard_bank_expenses_monthly(p_year integer)
RETURNS TABLE (
  month_num integer,
  month_key text,
  company_id uuid,
  total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    extract(month FROM bm.movement_date)::integer AS month_num,
    to_char(bm.movement_date, 'YYYY-MM') AS month_key,
    bm.company_id,
    round(sum(abs(bm.amount))::numeric, 2) AS total
  FROM public.bank_movements bm
  WHERE bm.is_expense
    AND extract(year FROM bm.movement_date)::integer = p_year
    AND public.user_can_access_bank_movements(bm.company_id)
  GROUP BY 1, 2, 3
  ORDER BY 1, 3;
$$;

CREATE OR REPLACE FUNCTION public.dashboard_bank_expenses_daily(
  p_from_date date,
  p_to_date date
)
RETURNS TABLE (
  day_date date,
  day_key text,
  company_id uuid,
  total numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    bm.movement_date::date AS day_date,
    to_char(bm.movement_date, 'YYYY-MM-DD') AS day_key,
    bm.company_id,
    round(sum(abs(bm.amount))::numeric, 2) AS total
  FROM public.bank_movements bm
  WHERE bm.is_expense
    AND bm.movement_date >= p_from_date
    AND bm.movement_date <= p_to_date
    AND public.user_can_access_bank_movements(bm.company_id)
  GROUP BY 1, 2, 3
  ORDER BY 1, 3;
$$;
