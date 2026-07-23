-- Sample corrupted vs ok provinces
SELECT address_state, count(*) FROM customers
WHERE address_state ILIKE '%CORU%'
GROUP BY 1 ORDER BY 2 DESC LIMIT 20;

-- legacy raw if exists
SELECT column_name FROM information_schema.columns
WHERE table_name ILIKE '%client%' AND column_name ILIKE '%pro%'
LIMIT 30;
