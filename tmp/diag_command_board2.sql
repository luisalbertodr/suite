-- Diagnóstico RPC sin auth: ejecutar partes que fallan
SELECT id, name FROM companies ORDER BY name LIMIT 10;

SELECT dunasoft.style_sync_hub_company_id() AS hub_id;

-- Probar plan_slot_minutes
SELECT dunasoft.plan_slot_minutes('10:00', '11:30');

-- Probar regex en line_items_typed (subset)
SELECT count(*) FROM public.invoice_items ii
LIMIT 1;

-- Probar columnas articles
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'invoice_items'
ORDER BY ordinal_position;

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'articles'
  AND column_name IN ('name', 'descripcion', 'tipo_producto', 'codigo');

-- Ejecutar función saltando auth: como postgres con usuario simulado
DO $$
DECLARE
  v_company uuid;
  v_user uuid;
  v_result jsonb;
BEGIN
  SELECT id INTO v_company FROM companies LIMIT 1;
  SELECT user_id INTO v_user FROM company_users LIMIT 1;
  IF v_user IS NULL THEN
    SELECT id INTO v_user FROM auth.users LIMIT 1;
  END IF;
  RAISE NOTICE 'company=% user=%', v_company, v_user;

  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  BEGIN
    v_result := public.dashboard_command_board_stats(
      v_company, v_company, '2026-07-01'::date, '2026-07-10'::date
    );
    RAISE NOTICE 'OK len=%', length(v_result::text);
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERROR: % %', SQLSTATE, SQLERRM;
  END;
END $$;
