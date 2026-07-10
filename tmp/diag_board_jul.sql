DO $$
DECLARE
  v_company uuid := '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
  v_user uuid := '256357e4-d428-42ab-a848-113a4d83fd67';
  v_result jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub', v_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  v_result := public.dashboard_command_board_stats(v_company, v_company, '2026-07-01'::date, '2026-07-10'::date);
  RAISE NOTICE 'sales tickets total: %', v_result #>> '{sales,tickets,total}';
  RAISE NOTICE 'sales invoiced total: %', v_result #>> '{sales,invoiced,total}';
  RAISE NOTICE 'reservations scheduled: %', v_result #>> '{reservations,scheduled}';
  RAISE NOTICE 'clients periodActive: %', v_result #>> '{clients,periodActive}';
  RAISE NOTICE 'full: %', left(v_result::text, 800);
END $$;

-- Facturas en rango sin filtro style
SELECT count(*), round(sum(total_amount)::numeric,2)
FROM public.invoices i
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
  AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada');

-- Con filtro style hub
SELECT count(*), round(sum(i.total_amount)::numeric,2)
FROM public.invoices i
INNER JOIN dunasoft.style_sync_entity_map m ON m.suite_id = i.id AND m.entity_type = 'invoice'
WHERE i.issue_date BETWEEN '2026-07-01' AND '2026-07-10'
  AND lower(coalesce(i.status, '')) NOT IN ('cancelled', 'void', 'anulada')
  AND m.company_id = dunasoft.style_sync_hub_company_id()
  AND m.style_key LIKE '2026/%';
