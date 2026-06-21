SELECT c.id AS customer_id, c.name, c.tax_id
FROM public.customers c
WHERE upper(replace(c.tax_id, '-', '')) LIKE '%32686441%'
LIMIT 5;

SELECT m.id, m.measured_at::date, m.inbody_user_id,
       m.weight_kg, m.smm_kg, m.body_fat_kg, m.body_fat_min_kg, m.body_fat_max_kg,
       m.pbf_pct, m.pbf_min_pct, m.pbf_max_pct,
       m.bca
FROM public.inbody_measurements m
JOIN public.customers c ON c.id = m.customer_id
WHERE upper(replace(c.tax_id, '-', '')) LIKE '%32686441%'
  AND m.measured_at::date = '2017-10-31'
ORDER BY m.measured_at;
