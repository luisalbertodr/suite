-- Separación fiscal: resolver empresa emisora por línea de factura/venta
-- y ampliar RLS de facturas dentro del mismo centro laboral.

-- ---------------------------------------------------------------------------
-- 1. Resolver billing_company_id desde descripción de línea (código artículo)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_line_billing_company_id(
  p_description TEXT,
  p_catalog_company_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_billing UUID;
  v_default UUID;
BEGIN
  IF p_catalog_company_id IS NULL THEN
    RETURN public.get_user_company_id();
  END IF;

  v_default := p_catalog_company_id;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RETURN v_default;
  END IF;

  v_code := btrim(substring(p_description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*'));
  IF v_code IS NULL OR v_code = '' THEN
    RETURN v_default;
  END IF;

  SELECT COALESCE(a.billing_company_id, af.billing_company_id, p_catalog_company_id)
  INTO v_billing
  FROM public.articles a
  LEFT JOIN public.article_families af
    ON af.company_id = a.company_id AND af.name = a.familia
  WHERE a.company_id = p_catalog_company_id
    AND (
      upper(btrim(a.codigo)) = upper(v_code)
      OR btrim(coalesce(a.legacy_codart, '')) = v_code
      OR upper(btrim(coalesce(a.legacy_codart, ''))) = upper(v_code)
    )
  ORDER BY a.updated_at DESC NULLS LAST
  LIMIT 1;

  RETURN COALESCE(v_billing, v_default);
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_line_billing_company_id(TEXT, UUID)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 2. Empresa emisora dominante de una factura (por importe de líneas)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.resolve_invoice_billing_company_id(
  p_invoice_id UUID,
  p_catalog_company_id UUID
)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (
      SELECT r.billing_company_id
      FROM (
        SELECT
          public.resolve_line_billing_company_id(ii.description, p_catalog_company_id)
            AS billing_company_id,
          SUM(COALESCE(ii.total_price, 0)) AS amount
        FROM public.invoice_items ii
        WHERE ii.invoice_id = p_invoice_id
        GROUP BY 1
        ORDER BY amount DESC
        LIMIT 1
      ) r
    ),
    p_catalog_company_id
  );
$$;

GRANT EXECUTE ON FUNCTION public.resolve_invoice_billing_company_id(UUID, UUID)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 3. RLS facturas: lectura/edición cruzada en centro laboral
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view invoices in their company" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices in their company" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices in their company" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete invoices in their company" ON public.invoices;

CREATE POLICY "Users can view invoices in their company"
  ON public.invoices FOR SELECT TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can insert invoices in their company"
  ON public.invoices FOR INSERT TO authenticated
  WITH CHECK (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can update invoices in their company"
  ON public.invoices FOR UPDATE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

CREATE POLICY "Users can delete invoices in their company"
  ON public.invoices FOR DELETE TO authenticated
  USING (
    company_id = public.get_user_company_id()
    OR public.company_in_user_work_center(company_id)
  );

-- invoice_items heredan acceso vía factura padre
DROP POLICY IF EXISTS "Users can view invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can insert invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can update invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Users can delete invoice items" ON public.invoice_items;

CREATE POLICY "Users can view invoice items"
  ON public.invoice_items FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND (
          i.company_id = public.get_user_company_id()
          OR public.company_in_user_work_center(i.company_id)
        )
    )
  );

CREATE POLICY "Users can insert invoice items"
  ON public.invoice_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND (
          i.company_id = public.get_user_company_id()
          OR public.company_in_user_work_center(i.company_id)
        )
    )
  );

CREATE POLICY "Users can update invoice items"
  ON public.invoice_items FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND (
          i.company_id = public.get_user_company_id()
          OR public.company_in_user_work_center(i.company_id)
        )
    )
  );

CREATE POLICY "Users can delete invoice items"
  ON public.invoice_items FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_items.invoice_id
        AND (
          i.company_id = public.get_user_company_id()
          OR public.company_in_user_work_center(i.company_id)
        )
    )
  );
