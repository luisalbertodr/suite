DO $$
DECLARE
  v_company uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
  v_user uuid := '256357e4-d428-42ab-a848-113a4d83fd67';
  v_result jsonb;
  t0 timestamptz;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  PERFORM set_config('role', 'authenticated', true);

  SET LOCAL statement_timeout = '8s';
  t0 := clock_timestamp();
  v_result := public.dashboard_command_board_stats(v_company, v_company, '2026-07-01'::date, '2026-07-10'::date);
  RAISE NOTICE 'month10 ok ms=%', extract(epoch FROM (clock_timestamp() - t0)) * 1000;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'month10 fail: %', SQLERRM;
END $$;

DO $$
DECLARE
  v_company uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
  v_user uuid := '256357e4-d428-42ab-a848-113a4d83fd67';
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  SET LOCAL statement_timeout = '8s';
  v_result := public.dashboard_command_board_stats(v_company, v_company, '2026-07-01'::date, '2026-07-31'::date);
  RAISE NOTICE 'full_july ok';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'full_july fail: %', SQLERRM;
END $$;
