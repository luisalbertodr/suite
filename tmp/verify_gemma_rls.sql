-- Simular sesión Gemma para RLS marketing
BEGIN;
SELECT set_config('request.jwt.claim.sub', 'c3017f22-b618-4244-bbae-a578f8f22730', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SET LOCAL ROLE authenticated;

\echo '=== Empresas accesibles (como Gemma) ==='
SELECT * FROM public.get_user_accessible_company_ids();

\echo '=== user_can_access_company marketing host ==='
SELECT public.user_can_access_company('5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'::uuid);

\echo '=== SELECT leads (limit 1) ==='
SELECT id, first_name, stage_id FROM public.marketing_leads
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
LIMIT 1;

\echo '=== UPDATE lead test (rollback) ==='
WITH t AS (
  SELECT id FROM public.marketing_leads
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4' AND archived_at IS NULL
  LIMIT 1
)
UPDATE public.marketing_leads l
SET updated_at = now()
FROM t WHERE l.id = t.id
RETURNING l.id, 'update_ok' AS status;

\echo '=== UPDATE stage test ==='
WITH t AS (
  SELECT id FROM public.marketing_lead_stages
  WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  LIMIT 1
)
UPDATE public.marketing_lead_stages s
SET updated_at = now()
FROM t WHERE s.id = t.id
RETURNING s.id, s.name, 'stage_update_ok' AS status;

ROLLBACK;
