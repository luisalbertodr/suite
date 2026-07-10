\pset format aligned

SELECT column_name FROM information_schema.columns
WHERE table_schema='dunasoft' AND table_name='plan2009'
ORDER BY ordinal_position;

\echo '=== plan2009 codcli 008251 ==='
SELECT * FROM dunasoft.plan2009 WHERE codcli = '008251' ORDER BY fecha DESC LIMIT 5;

\echo '=== plan2009 nombre Joanella ==='
SELECT idplan, fecha, codcli, nombre, facturado FROM dunasoft.plan2009
WHERE nombre ILIKE '%Joanella%' ORDER BY fecha DESC LIMIT 10;
