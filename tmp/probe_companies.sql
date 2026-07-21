SELECT id::text, name FROM public.companies ORDER BY name;
SELECT company_id::text, count(*) AS n FROM public.customers GROUP BY 1 ORDER BY 2 DESC;
SELECT id::text, name, company_id::text
FROM public.customers
WHERE lower(name) LIKE '%alba%alvarez%'
   OR lower(name) LIKE '%josefina%cousillas%'
LIMIT 20;
