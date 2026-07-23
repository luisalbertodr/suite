SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'dunasoft' AND table_name = 'clientes'
  AND column_name IN ('altura','altura_cm','height','pesoe');

SELECT pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'dunasoft' AND p.proname = 'style_clientes_apply_from_style';

SELECT codcli, nomcli, altura
FROM dunasoft.clientes
WHERE altura IS NOT NULL AND altura > 0
LIMIT 10;

SELECT count(*) FILTER (WHERE altura IS NOT NULL AND altura > 0) AS with_altura,
       count(*) AS total
FROM dunasoft.clientes;
