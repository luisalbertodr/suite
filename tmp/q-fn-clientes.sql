SELECT pg_get_functiondef(p.oid)
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'dunasoft' AND p.proname = 'style_clientes_apply_from_style';
