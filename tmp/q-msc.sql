SELECT measured_at, weight_kg, pbf_pct, muscle_kg, body_water_pct, bone_mass_kg,
       raw_payload->>'body_comp_hex' AS hex
FROM inbody_measurements
WHERE raw_payload->>'source' = 'renpho-msc04'
   OR device ILIKE '%orpho%'
   OR device ILIKE '%MSC%'
ORDER BY measured_at DESC
LIMIT 8;
