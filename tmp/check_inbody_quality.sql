SELECT measured_at, body_fat_kg, pbf_pct, data_quality->>'status' AS status,
       data_quality->>'needs_repeat' AS needs_repeat,
       data_quality->'hint' AS hint
FROM inbody_measurements
WHERE inbody_user_id ILIKE '%32686441%'
  AND measured_at::date IN ('2017-10-31', '2017-09-25')
ORDER BY measured_at;

SELECT COUNT(*) FILTER (WHERE data_quality->>'needs_repeat' = 'true') AS suspicious_total,
       COUNT(*) AS total
FROM inbody_measurements;
