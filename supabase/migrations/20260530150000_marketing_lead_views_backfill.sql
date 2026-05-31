-- Marcar todos los leads existentes (no archivados) como ya vistos por cada
-- usuario con acceso a la empresa del lead (perfiles + roles por empresa).
INSERT INTO public.marketing_lead_views (user_id, lead_id, company_id, viewed_at)
SELECT access.user_id, ml.id, ml.company_id, now()
FROM public.marketing_leads ml
INNER JOIN (
  SELECT company_id, user_id
  FROM public.user_profiles
  WHERE company_id IS NOT NULL
  UNION
  SELECT company_id, user_id
  FROM public.user_company_roles
  WHERE company_id IS NOT NULL
) access ON access.company_id = ml.company_id
WHERE ml.archived_at IS NULL
ON CONFLICT (user_id, lead_id) DO NOTHING;
