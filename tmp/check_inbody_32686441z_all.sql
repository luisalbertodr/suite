SELECT m.id, m.customer_id, m.inbody_user_id, m.company_id, m.measured_at::text,
       m.body_fat_kg, m.body_fat_min_kg, m.body_fat_max_kg,
       m.pbf_pct, m.pbf_min_pct, m.pbf_max_pct, m.weight_kg
FROM public.inbody_measurements m
WHERE m.inbody_user_id ILIKE '%32686441%'
   OR m.inbody_user_id ILIKE '%32686441Z%'
ORDER BY m.measured_at;

SELECT count(*) FROM public.inbody_measurements;

SELECT m.measured_at::date, m.body_fat_kg, m.body_fat_min_kg, m.body_fat_max_kg, c.tax_id
FROM public.inbody_measurements m
LEFT JOIN public.customers c ON c.id = m.customer_id
WHERE m.measured_at >= '2017-10-30' AND m.measured_at < '2017-11-02'
  AND (m.body_fat_kg BETWEEN 1 AND 3 OR m.body_fat_min_kg > 10)
ORDER BY m.measured_at
LIMIT 20;
