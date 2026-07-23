-- Variantes restantes de Coruña mal escritas
UPDATE public.customers
SET address_state = 'A CORUÑA'
WHERE address_state ~* 'coru'
  AND address_state !~* 'coruñ'
  AND (
    address_state ILIKE '%CORUC%'
    OR address_state ILIKE '%CORUQ%'
    OR address_state LIKE '%' || CHR(65533) || '%'
    OR address_state LIKE '%CORU_A%'
  );

UPDATE public.customers
SET address_city = 'A CORUÑA'
WHERE address_city ~* 'coru'
  AND address_city !~* 'coruñ'
  AND (
    address_city ILIKE '%CORUC%'
    OR address_city ILIKE '%CORUQ%'
    OR address_city LIKE '%' || CHR(65533) || '%'
    OR address_city LIKE '%CORU_A%'
  );

-- Mostrar qué queda
SELECT address_state, count(*),
       encode(convert_to(address_state, 'UTF8'), 'hex') AS hex
FROM public.customers
WHERE address_state ILIKE '%CORU%' OR address_state ILIKE '%oru%'
GROUP BY 1
ORDER BY 2 DESC;
