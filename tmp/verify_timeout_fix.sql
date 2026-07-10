SELECT pg_get_functiondef('public.dashboard_command_board_stats(uuid,uuid,date,date)'::regprocedure) LIKE '%statement_timeout%120s%' AS has_timeout;

DO $$
DECLARE
  v_company uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
  v_user uuid := '256357e4-d428-42ab-a848-113a4d83fd67';
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL statement_timeout = '8s';
  v_result := public.dashboard_command_board_stats(v_company, v_company, '2026-01-01'::date, '2026-07-10'::date);
  RAISE NOTICE 'ytd ok under role 8s';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ytd fail: %', SQLERRM;
END $$;
