\echo '=== style_sync_cursor ciecab ==='
SELECT company_id::text, tabla, enabled, dbf_baseline_seeded, updated_at
FROM dunasoft.style_sync_cursor WHERE tabla = 'ciecab';

\echo '=== cash_register_sessions ultimos 12 ==='
SELECT session_date, status, opening_cash, expected_cash, expected_card,
       counted_cash, counted_card, closing_cash, left(notes, 60) notes, updated_at
FROM public.cash_register_sessions
ORDER BY session_date DESC LIMIT 12;

\echo '=== style_sync_entity_map cash_session recientes ==='
SELECT style_key, suite_id::text, sync_version, updated_at
FROM dunasoft.style_sync_entity_map
WHERE entity_type = 'cash_session'
ORDER BY updated_at DESC LIMIT 10;

\echo '=== legacy.ciecab ultimos 10 ==='
SELECT numcie, feccie, impcie, cerrado
FROM legacy.ciecab
WHERE NULLIF(btrim(feccie),'') IS NOT NULL
ORDER BY feccie DESC LIMIT 10;

\echo '=== cieentsal agregado desde 2026-06-25 ==='
SELECT c.feccie, c.numcie, c.impcie,
  COALESCE(SUM(CASE WHEN e.tipdoc='E' AND UPPER(e.forpag) LIKE '%EFECT%'
    THEN e.impdoc::numeric ELSE 0 END),0) cash_e,
  COALESCE(SUM(CASE WHEN e.tipdoc='E' AND UPPER(e.forpag) LIKE '%TARJ%'
    THEN e.impdoc::numeric ELSE 0 END),0) card_e
FROM legacy.ciecab c
LEFT JOIN legacy.cieentsal e ON e.numcie = c.numcie
WHERE c.feccie >= '2026-06-25'
GROUP BY c.feccie, c.numcie, c.impcie
ORDER BY c.feccie DESC LIMIT 12;

\echo '=== ventas completadas ultimos dias ==='
SELECT created_at::date AS d, count(*)::int n, sum(total_amount)::numeric total
FROM public.sales
WHERE status = 'completed' AND created_at::date >= current_date - 12
GROUP BY 1 ORDER BY 1 DESC;
