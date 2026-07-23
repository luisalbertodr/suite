SELECT measured_at, device, weight_kg, customer_id IS NOT NULL AS linked,
       bone_mass_kg, body_water_pct, visceral_fat_index, metabolic_age, source,
       left(raw_payload::text, 120) AS raw_preview
FROM inbody_measurements
WHERE device = 'morphoscan' OR source ILIKE '%ble%' OR source ILIKE '%scale%'
ORDER BY measured_at DESC
LIMIT 8;
