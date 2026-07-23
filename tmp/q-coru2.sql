SELECT
  count(*) FILTER (WHERE address_state ILIKE '%CORUQ%') AS coruq_state,
  count(*) FILTER (WHERE address_city ILIKE '%CORUQ%') AS coruq_city,
  count(*) FILTER (WHERE name ILIKE '%qoz%' OR name ILIKE '%iqo%' OR name ILIKE '%uqez%' OR name ILIKE '%aqo%') AS name_qish
FROM customers;

SELECT name, address_city, address_state
FROM customers
WHERE name ILIKE '%qoz%' OR name ILIKE '%iqo%' OR name ILIKE '%Muq%'
LIMIT 15;

SELECT encode(convert_to(address_state, 'UTF8'), 'hex') AS hex_state, address_state
FROM customers
WHERE address_state ILIKE '%CORUQ%'
LIMIT 3;
