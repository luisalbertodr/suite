SELECT c.name, m.measured_at, m.weight_kg, m.pbf_pct, m.body_fat_kg, m.smm_kg, m.slm_kg,
       m.body_water_pct, m.tbw_kg, m.bone_mass_kg, m.protein_mass_kg, m.protein_pct, m.bmi,
       m.visceral_fat_index, m.bmr_kcal, m.metabolic_age, m.height_cm, m.age_years, m.sex,
       m.segmental_fat, m.segmental_lean,
       m.raw_payload->>'body_comp_hex' AS hex,
       m.raw_payload->>'fat_source' AS fat_source,
       m.raw_payload->>'note' AS note
FROM inbody_measurements m
LEFT JOIN customers c ON c.id = m.customer_id
WHERE m.measured_at > now() - interval '12 hours'
ORDER BY m.measured_at DESC
LIMIT 5;
