-- Dashboard M/E: clasificar por familia/artículo de cada línea (no por company_id de factura).
-- Medicina = familias 025-MEDICINA ESTETICA, 23-BMED, 33-SKYMEDIC + Fotrej/manchas de 09-Facial.

-- Foto Manchas (09-Facial) → medicina, alineado con Fotrej
UPDATE public.articles
SET billing_company_id = '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid,
    updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid
  AND upper(btrim(codigo)) = 'LEG-01009';

CREATE OR REPLACE FUNCTION public.dashboard_resolve_line_billing_company_id(
  p_description text,
  p_catalog_company_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_med_billing uuid := '816af484-92a0-4f65-a5a7-1c907aa4bb3d';
  v_default uuid;
  v_code text;
  v_legacy text;
  v_billing uuid;
BEGIN
  IF p_catalog_company_id IS NULL THEN
    RETURN public.get_user_company_id();
  END IF;

  v_default := p_catalog_company_id;

  IF p_description IS NULL OR btrim(p_description) = '' THEN
    RETURN v_default;
  END IF;

  -- 1) Código al inicio «COD - descripción»
  v_code := btrim(substring(p_description FROM '^([A-Za-z0-9._-]+)\s*[-–—]\s*'));
  IF v_code IS NOT NULL AND v_code <> '' THEN
    SELECT COALESCE(a.billing_company_id, af.billing_company_id, v_default)
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
    ORDER BY
      CASE WHEN COALESCE(a.billing_company_id, af.billing_company_id) = v_med_billing THEN 0 ELSE 1 END,
      a.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_billing IS NOT NULL THEN
      RETURN v_billing;
    END IF;
  END IF;

  -- 2) Descripción exacta (Style sync guarda desart sin código)
  SELECT COALESCE(a.billing_company_id, af.billing_company_id, v_default)
  INTO v_billing
  FROM public.articles a
  LEFT JOIN public.article_families af
    ON af.company_id = a.company_id AND af.name = a.familia
  WHERE a.company_id = p_catalog_company_id
    AND upper(btrim(a.descripcion)) = upper(btrim(p_description))
  ORDER BY
    CASE WHEN COALESCE(a.billing_company_id, af.billing_company_id) = v_med_billing THEN 0 ELSE 1 END,
    a.updated_at DESC NULLS LAST
  LIMIT 1;

  IF v_billing IS NOT NULL THEN
    RETURN v_billing;
  END IF;

  -- 3) Sufijo legacy [codart]
  v_legacy := (regexp_match(btrim(p_description), '\[(\d+)\]\s*$'))[1];
  IF v_legacy IS NOT NULL AND v_legacy <> '' THEN
    SELECT COALESCE(a.billing_company_id, af.billing_company_id, v_default)
    INTO v_billing
    FROM public.articles a
    LEFT JOIN public.article_families af
      ON af.company_id = a.company_id AND af.name = a.familia
    WHERE a.company_id = p_catalog_company_id
      AND btrim(coalesce(a.legacy_codart, '')) = v_legacy
    ORDER BY
      CASE WHEN COALESCE(a.billing_company_id, af.billing_company_id) = v_med_billing THEN 0 ELSE 1 END,
      a.updated_at DESC NULLS LAST
    LIMIT 1;

    IF v_billing IS NOT NULL THEN
      RETURN v_billing;
    END IF;
  END IF;

  -- 4) 09-Facial: Fotrej / manchas por palabra clave
  IF upper(p_description) ~ '(FOTREJ|FOTORREJ|MANCHA)' THEN
    SELECT COALESCE(a.billing_company_id, af.billing_company_id, v_med_billing)
    INTO v_billing
    FROM public.articles a
    LEFT JOIN public.article_families af
      ON af.company_id = a.company_id AND af.name = a.familia
    WHERE a.company_id = p_catalog_company_id
      AND af.name ILIKE '09-Facial%'
      AND upper(btrim(a.descripcion)) = upper(btrim(p_description))
    LIMIT 1;

    IF v_billing IS NOT NULL THEN
      RETURN v_billing;
    END IF;
  END IF;

  RETURN v_default;
END;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_resolve_line_billing_company_id(text, uuid)
  TO authenticated, service_role;

COMMENT ON FUNCTION public.dashboard_resolve_line_billing_company_id IS
  'Empresa emisora fiscal de una línea de factura para el dashboard (catálogo host + descripción Style).';

CREATE OR REPLACE FUNCTION public.dashboard_billing_monthly_split(
  p_year int DEFAULT NULL
)
RETURNS TABLE (
  month_num int,
  month_key text,
  company_id uuid,
  total     numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, dunasoft
AS $$
  WITH yr AS (
    SELECT coalesce(p_year, extract(year FROM current_date)::int) AS y
  ),
  hub AS (
    SELECT dunasoft.style_sync_hub_company_id() AS catalog_id
  ),
  constants AS (
    SELECT
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid AS med_billing_id,
      '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid AS report_medicina_id,
      '816af484-92a0-4f65-a5a7-1c907aa4bb3d'::uuid AS report_estetica_id
  ),
  style_invoices AS (
    SELECT i.id, i.issue_date
    FROM public.invoices i
    INNER JOIN dunasoft.style_sync_entity_map m
      ON m.suite_id = i.id
     AND m.entity_type = 'invoice'
    LEFT JOIN dunasoft.style_sync_billing_exclusions e
      ON e.company_id = m.company_id
     AND e.style_key = m.style_key
    CROSS JOIN yr
    CROSS JOIN hub
    WHERE extract(year FROM i.issue_date) = yr.y
      AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
      AND e.style_key IS NULL
      AND m.company_id = hub.catalog_id
      AND m.style_key LIKE yr.y::text || '/%'
  ),
  line_amounts AS (
    SELECT
      extract(month FROM si.issue_date)::int AS month_num,
      to_char(si.issue_date, 'YYYY-MM') AS month_key,
      CASE
        WHEN public.dashboard_resolve_line_billing_company_id(ii.description, hub.catalog_id)
          = c.med_billing_id
        THEN c.report_medicina_id
        ELSE c.report_estetica_id
      END AS report_company_id,
      coalesce(ii.total_price, 0)::numeric AS amount
    FROM style_invoices si
    INNER JOIN public.invoice_items ii ON ii.invoice_id = si.id
    CROSS JOIN hub
    CROSS JOIN constants c
  )
  SELECT
    la.month_num,
    la.month_key,
    la.report_company_id AS company_id,
    round(sum(la.amount)::numeric, 2) AS total
  FROM line_amounts la
  GROUP BY 1, 2, 3
  ORDER BY 1, 3;
$$;

GRANT EXECUTE ON FUNCTION public.dashboard_billing_monthly_split(int) TO authenticated, service_role;

COMMENT ON FUNCTION public.dashboard_billing_monthly_split IS
  'Facturación Style sync por mes y área (Medicina/Estética) según familia de artículo en cada línea.';
