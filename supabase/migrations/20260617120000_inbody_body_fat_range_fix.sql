-- LookInBody MFA: PBFM_MIN/PBFM_MAX son % normal (12–20), no kg. Corrige rangos invertidos en BD.

UPDATE public.inbody_measurements m
SET
  body_fat_min_kg = m.weight_kg * LEAST(m.body_fat_min_kg, m.body_fat_max_kg) / 100.0,
  body_fat_max_kg = m.weight_kg * GREATEST(m.body_fat_min_kg, m.body_fat_max_kg) / 100.0
WHERE m.body_fat_min_kg IS NOT NULL
  AND m.body_fat_max_kg IS NOT NULL
  AND m.body_fat_min_kg > m.body_fat_max_kg
  AND m.body_fat_min_kg <= 80
  AND m.body_fat_max_kg <= 80
  AND m.weight_kg IS NOT NULL
  AND m.weight_kg > 0;
