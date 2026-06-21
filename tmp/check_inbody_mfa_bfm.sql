SELECT id, measured_at::date,
       body_fat_kg, body_fat_min_kg, body_fat_max_kg,
       pbf_pct, pbf_min_pct, pbf_max_pct, weight_kg,
       mfa->>'BFM' AS mfa_bfm, mfa->>'PBFM_MIN' AS mfa_pbfm_min, mfa->>'PBFM_MAX' AS mfa_pbfm_max,
       bca->>'BFM' AS bca_bfm, bca->>'PBF' AS bca_pbf
FROM public.inbody_measurements
WHERE id IN (
  '0d8ccc44-4ea0-4049-94b6-88f94be43d5e',
  '15c28a8a-3922-4993-908e-3082f0ca2c5e',
  '0079f365-2d8d-4e7e-9316-57bb0ee2286e'
);
