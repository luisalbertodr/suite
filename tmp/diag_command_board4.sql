DO $$
DECLARE
  v_op uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
  v_catalog uuid;
  v_user uuid := '256357e4-d428-42ab-a848-113a4d83fd67';
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  -- Probar cada empresa como catalog
  FOR v_catalog IN SELECT id FROM companies ORDER BY name LOOP
    BEGIN
      v_result := public.dashboard_command_board_stats(
        v_op, v_catalog, '2026-01-01'::date, '2026-07-10'::date
      );
      RAISE NOTICE 'OK catalog=%', v_catalog;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'FAIL catalog=% : %', v_catalog, SQLERRM;
    END;
  END LOOP;
END $$;
