-- Vistas por usuario en leads de marketing (badge «pendientes de ver»)
CREATE TABLE IF NOT EXISTS public.marketing_lead_views (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES public.marketing_leads(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lead_id)
);

CREATE INDEX IF NOT EXISTS marketing_lead_views_user_company_idx
  ON public.marketing_lead_views(user_id, company_id);

ALTER TABLE public.marketing_lead_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS marketing_lead_views_select_own ON public.marketing_lead_views;
CREATE POLICY marketing_lead_views_select_own
  ON public.marketing_lead_views FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS marketing_lead_views_insert_own ON public.marketing_lead_views;
CREATE POLICY marketing_lead_views_insert_own
  ON public.marketing_lead_views FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.user_can_access_company(company_id)
    AND EXISTS (
      SELECT 1 FROM public.marketing_leads ml
      WHERE ml.id = lead_id AND ml.company_id = company_id
    )
  );

DROP POLICY IF EXISTS marketing_lead_views_update_own ON public.marketing_lead_views;
CREATE POLICY marketing_lead_views_update_own
  ON public.marketing_lead_views FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Cuenta leads activos sin registro de vista para el usuario actual.
CREATE OR REPLACE FUNCTION public.count_marketing_unviewed_leads(p_company_ids UUID[] DEFAULT NULL)
RETURNS BIGINT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH scope AS (
    SELECT x.company_id
    FROM (
      SELECT unnest(
        CASE
          WHEN p_company_ids IS NOT NULL AND cardinality(p_company_ids) > 0
          THEN p_company_ids
          ELSE ARRAY(SELECT bc FROM public.get_work_center_billing_companies() AS bc)
        END
      ) AS company_id
    ) x
    WHERE public.user_can_access_company(x.company_id)
  )
  SELECT COUNT(*)::bigint
  FROM public.marketing_leads ml
  INNER JOIN scope s ON s.company_id = ml.company_id
  WHERE ml.archived_at IS NULL
    AND auth.uid() IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.marketing_lead_views v
      WHERE v.lead_id = ml.id
        AND v.user_id = auth.uid()
    );
$$;

GRANT EXECUTE ON FUNCTION public.count_marketing_unviewed_leads(UUID[]) TO authenticated;

COMMENT ON TABLE public.marketing_lead_views IS
  'Registro por usuario de leads de marketing ya abiertos/vistos (badge en dock).';
