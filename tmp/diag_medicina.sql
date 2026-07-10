DO $$
DECLARE
  v_company uuid := '816af484-92a0-4f65-a5a7-1c907aa4bb3d';
  v_user uuid := '256357e4-d428-42ab-a848-113a4d83fd67';
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  v_result := public.dashboard_command_board_stats(v_company, v_company, '2026-07-01'::date, '2026-07-10'::date);
  RAISE NOTICE 'medicina OK';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'medicina ERROR: %', SQLERRM;
END $$;
