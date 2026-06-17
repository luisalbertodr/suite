-- Consulta y desvinculación InBody DNI 32793227B de Mari Carmen Valiño Pantin

SELECT c.id, c.name, c.tax_id, c.company_id
FROM customers c
WHERE c.name ILIKE '%Mari Carmen%Vali%'
   OR c.name ILIKE '%Valiño%Pantin%'
LIMIT 10;

SELECT im.id, im.inbody_user_id, im.customer_id, im.measured_at, c.name AS customer_name, c.tax_id
FROM inbody_measurements im
LEFT JOIN customers c ON c.id = im.customer_id
WHERE upper(regexp_replace(im.inbody_user_id, '[^A-Z0-9]', '', 'g')) LIKE '%32793227B%'
ORDER BY im.measured_at DESC
LIMIT 20;

-- Desvincular mediciones InBody con ese DNI de cualquier ficha de cliente
UPDATE inbody_measurements
SET customer_id = NULL,
    updated_at = now()
WHERE upper(regexp_replace(inbody_user_id, '[^A-Z0-9]', '', 'g')) LIKE '%32793227B%'
  AND customer_id IS NOT NULL;

SELECT im.id, im.inbody_user_id, im.customer_id, im.measured_at, c.name AS customer_name
FROM inbody_measurements im
LEFT JOIN customers c ON c.id = im.customer_id
WHERE upper(regexp_replace(im.inbody_user_id, '[^A-Z0-9]', '', 'g')) LIKE '%32793227B%'
ORDER BY im.measured_at DESC
LIMIT 10;
