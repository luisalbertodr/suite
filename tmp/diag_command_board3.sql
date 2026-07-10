DO $$
DECLARE
  v_company uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
  v_user uuid;
  v_result jsonb;
BEGIN
  SELECT ucr.user_id INTO v_user
  FROM public.user_company_roles ucr
  WHERE ucr.company_id = v_company
  LIMIT 1;
  IF v_user IS NULL THEN
    SELECT id INTO v_user FROM auth.users LIMIT 1;
  END IF;
  RAISE NOTICE 'company=% user=%', v_company, v_user;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  RAISE NOTICE 'can_access=%', public.user_can_access_company(v_company);

  v_result := public.dashboard_command_board_stats(
    v_company, v_company, '2026-07-01'::date, '2026-07-10'::date
  );
  RAISE NOTICE 'OK keys=%', (SELECT array_agg(key) FROM jsonb_object_keys(v_result) key);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'ERROR: % %', SQLSTATE, SQLERRM;
END $$;
