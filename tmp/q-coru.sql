SELECT id, name, address_city, address_state
FROM customers
WHERE address_city ILIKE '%CORU%'
   OR address_city ILIKE '%oru%'
   OR address_state ILIKE '%CORU%'
LIMIT 30;
