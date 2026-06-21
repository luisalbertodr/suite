-- Verificar medición 32686441Z 2017-10-31 tras corrección de rangos
SELECT measured_at, weight_kg, body_fat_kg, body_fat_min_kg, body_fat_max_kg, pbf_pct
FROM inbody_measurements
WHERE inbody_user_id ILIKE '%32686441%'
  AND measured_at::date = '2017-10-31'
ORDER BY measured_at;
