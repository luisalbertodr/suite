\dt *.*client*
SELECT table_schema, table_name FROM information_schema.tables
WHERE table_name ILIKE '%client%' OR table_name ILIKE '%legacy%'
ORDER BY 1,2
LIMIT 40;
