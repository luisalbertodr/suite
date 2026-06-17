-- Vista de equipo en marketing: un lead deja de ser «NUEVO» para todos al consultarlo/editarlo.

ALTER TABLE public.marketing_leads
  ADD COLUMN IF NOT EXISTS team_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS team_viewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.marketing_leads.team_viewed_at IS
  'Primera vez que cualquier usuario del equipo consultó el lead (badge NUEVO compartido).';
COMMENT ON COLUMN public.marketing_leads.team_viewed_by IS
  'Usuario que marcó el lead como visto por primera vez.';

-- Si algún usuario ya lo había visto (tabla legacy), considerarlo visto por el equipo.
UPDATE public.marketing_leads ml
SET
  team_viewed_at = sub.max_viewed,
  team_viewed_by = sub.last_viewer
FROM (
  SELECT
    v.lead_id,
    MAX(v.viewed_at) AS max_viewed,
    (ARRAY_AGG(v.user_id ORDER BY v.viewed_at DESC))[1] AS last_viewer
  FROM public.marketing_lead_views v
  GROUP BY v.lead_id
) sub
WHERE ml.id = sub.lead_id
  AND ml.team_viewed_at IS NULL;

CREATE INDEX IF NOT EXISTS marketing_leads_team_unviewed_idx
  ON public.marketing_leads (company_id)
  WHERE archived_at IS NULL AND team_viewed_at IS NULL;

CREATE OR REPLACE FUNCTION public.mark_marketing_lead_team_viewed(p_lead_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.marketing_leads ml
  SET
    team_viewed_at = COALESCE(ml.team_viewed_at, now()),
    team_viewed_by = COALESCE(ml.team_viewed_by, auth.uid())
  WHERE ml.id = p_lead_id
    AND ml.archived_at IS NULL
    AND public.user_can_access_company(ml.company_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_marketing_lead_team_viewed(UUID) TO authenticated;

-- Cuenta leads activos sin consultar por ningún usuario del equipo.
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
    AND ml.team_viewed_at IS NULL;
$$;

COMMENT ON TABLE public.marketing_lead_views IS
  'Legacy: vistas por usuario. Sustituido por marketing_leads.team_viewed_at (equipo).';
