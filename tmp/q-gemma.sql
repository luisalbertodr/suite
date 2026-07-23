SELECT c.name, m.measured_at, m.weight_kg, m.pbf_pct, m.body_fat_kg, m.muscle_kg, m.smm_kg,
       m.body_water_pct, m.body_water_kg, m.bone_mass_kg, m.protein_kg, m.bmi,
       m.visceral_fat, m.bmr_kcal, m.metabolic_age, m.device,
       left(m.raw_payload::text, 500) AS raw_head,
       m.raw_payload->>'body_comp_hex' AS hex
FROM inbody_measurements m
LEFT JOIN customers c ON c.id = m.customer_id
WHERE m.measured_at > now() - interval '6 hours'
ORDER BY m.measured_at DESC
LIMIT 8;
