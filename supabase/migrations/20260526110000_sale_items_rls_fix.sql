-- sale_items RLS: la política anterior hacía IN (SELECT id FROM sales WHERE company_id = …)
-- y materializaba decenas de miles de filas en cada INSERT → statement timeout.

CREATE INDEX IF NOT EXISTS idx_sales_company_id ON public.sales (company_id);

CREATE OR REPLACE FUNCTION public.sale_item_allowed(p_sale_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_company uuid := public.get_user_company_id();
  v_ok boolean := false;
  v_has_host boolean := false;
BEGIN
  IF p_sale_id IS NULL OR v_user_company IS NULL THEN
    RETURN false;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'sales'
      AND column_name = 'host_company_id'
  ) INTO v_has_host;

  IF v_has_host
     AND to_regprocedure('public.company_in_user_work_center(uuid)') IS NOT NULL THEN
    SELECT (
      s.company_id = v_user_company
      OR s.host_company_id = v_user_company
      OR public.company_in_user_work_center(s.company_id)
    )
    INTO v_ok
    FROM public.sales s
    WHERE s.id = p_sale_id;
  ELSE
    SELECT (s.company_id = v_user_company)
    INTO v_ok
    FROM public.sales s
    WHERE s.id = p_sale_id;
  END IF;

  RETURN COALESCE(v_ok, false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sale_item_allowed(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Users can access sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can manage sale items" ON public.sale_items;
DROP POLICY IF EXISTS "Users can view sale items in their company" ON public.sale_items;
DROP POLICY IF EXISTS "Users can insert sale items in their company" ON public.sale_items;
DROP POLICY IF EXISTS "Users can update sale items in their company" ON public.sale_items;
DROP POLICY IF EXISTS "Users can delete sale items in their company" ON public.sale_items;

CREATE POLICY "Users can view sale items in their company"
  ON public.sale_items FOR SELECT
  USING (public.sale_item_allowed(sale_id));

CREATE POLICY "Users can insert sale items in their company"
  ON public.sale_items FOR INSERT
  WITH CHECK (public.sale_item_allowed(sale_id));

CREATE POLICY "Users can update sale items in their company"
  ON public.sale_items FOR UPDATE
  USING (public.sale_item_allowed(sale_id))
  WITH CHECK (public.sale_item_allowed(sale_id));

CREATE POLICY "Users can delete sale items in their company"
  ON public.sale_items FOR DELETE
  USING (public.sale_item_allowed(sale_id));
