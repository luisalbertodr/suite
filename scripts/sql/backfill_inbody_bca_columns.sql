-- Rellena columnas numéricas vacías desde bca (importaciones CSV con pick() roto).
UPDATE inbody_measurements m
SET
  height_cm = COALESCE(m.height_cm, NULLIF(btrim(m.bca->>'height_cm'), '')::numeric),
  age_years = COALESCE(m.age_years, NULLIF(btrim(m.bca->>'age_years'), '')::numeric),
  sex = COALESCE(NULLIF(btrim(m.sex), ''), NULLIF(btrim(m.bca->>'sex'), '')),
  weight_kg = COALESCE(m.weight_kg, NULLIF(btrim(m.bca->>'weight_kg'), '')::numeric),
  weight_min_kg = COALESCE(m.weight_min_kg, NULLIF(btrim(m.bca->>'weight_min_kg'), '')::numeric),
  weight_max_kg = COALESCE(m.weight_max_kg, NULLIF(btrim(m.bca->>'weight_max_kg'), '')::numeric),
  smm_kg = COALESCE(m.smm_kg, NULLIF(btrim(m.bca->>'smm_kg'), '')::numeric),
  smm_min_kg = COALESCE(m.smm_min_kg, NULLIF(btrim(m.bca->>'smm_min_kg'), '')::numeric),
  smm_max_kg = COALESCE(m.smm_max_kg, NULLIF(btrim(m.bca->>'smm_max_kg'), '')::numeric),
  body_fat_kg = COALESCE(m.body_fat_kg, NULLIF(btrim(m.bca->>'body_fat_kg'), '')::numeric),
  body_fat_min_kg = COALESCE(m.body_fat_min_kg, NULLIF(btrim(m.bca->>'body_fat_min_kg'), '')::numeric),
  body_fat_max_kg = COALESCE(m.body_fat_max_kg, NULLIF(btrim(m.bca->>'body_fat_max_kg'), '')::numeric),
  tbw_kg = COALESCE(m.tbw_kg, NULLIF(btrim(m.bca->>'tbw_kg'), '')::numeric),
  tbw_min_kg = COALESCE(m.tbw_min_kg, NULLIF(btrim(m.bca->>'tbw_min_kg'), '')::numeric),
  tbw_max_kg = COALESCE(m.tbw_max_kg, NULLIF(btrim(m.bca->>'tbw_max_kg'), '')::numeric),
  ffm_kg = COALESCE(m.ffm_kg, NULLIF(btrim(m.bca->>'ffm_kg'), '')::numeric),
  ffm_min_kg = COALESCE(m.ffm_min_kg, NULLIF(btrim(m.bca->>'ffm_min_kg'), '')::numeric),
  ffm_max_kg = COALESCE(m.ffm_max_kg, NULLIF(btrim(m.bca->>'ffm_max_kg'), '')::numeric),
  bmi = COALESCE(m.bmi, NULLIF(btrim(m.bca->>'bmi'), '')::numeric),
  bmi_min = COALESCE(m.bmi_min, NULLIF(btrim(m.bca->>'bmi_min'), '')::numeric),
  bmi_max = COALESCE(m.bmi_max, NULLIF(btrim(m.bca->>'bmi_max'), '')::numeric),
  pbf_pct = COALESCE(m.pbf_pct, NULLIF(btrim(m.bca->>'pbf_pct'), '')::numeric),
  pbf_min_pct = COALESCE(m.pbf_min_pct, NULLIF(btrim(m.bca->>'pbf_min_pct'), '')::numeric),
  pbf_max_pct = COALESCE(m.pbf_max_pct, NULLIF(btrim(m.bca->>'pbf_max_pct'), '')::numeric),
  whr = COALESCE(m.whr, NULLIF(btrim(m.bca->>'whr'), '')::numeric),
  whr_min = COALESCE(m.whr_min, NULLIF(btrim(m.bca->>'whr_min'), '')::numeric),
  whr_max = COALESCE(m.whr_max, NULLIF(btrim(m.bca->>'whr_max'), '')::numeric),
  bmr_kcal = COALESCE(m.bmr_kcal, NULLIF(btrim(m.bca->>'bmr_kcal'), '')::numeric),
  bmr_min_kcal = COALESCE(m.bmr_min_kcal, NULLIF(btrim(m.bca->>'bmr_min_kcal'), '')::numeric),
  bmr_max_kcal = COALESCE(m.bmr_max_kcal, NULLIF(btrim(m.bca->>'bmr_max_kcal'), '')::numeric),
  muscle_control_kg = COALESCE(m.muscle_control_kg, NULLIF(btrim(m.bca->>'muscle_control_kg'), '')::numeric),
  fat_control_kg = COALESCE(m.fat_control_kg, NULLIF(btrim(m.bca->>'fat_control_kg'), '')::numeric),
  updated_at = now()
WHERE m.source = 'lookinbody_dbbackup_csv'
  AND m.bca IS NOT NULL
  AND m.bca <> '{}'::jsonb;

SELECT count(*) FILTER (WHERE weight_kg IS NOT NULL) AS con_peso,
       count(*) FILTER (WHERE weight_kg IS NULL) AS sin_peso
FROM inbody_measurements
WHERE source = 'lookinbody_dbbackup_csv';
