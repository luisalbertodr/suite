-- LookInBody MDB importó BMR_MIN/BMR_MAX invertidos (~93% de filas con rango).
-- Corregir orden para que min ≤ max.
UPDATE public.inbody_measurements
SET
  bmr_min_kcal = bmr_max_kcal,
  bmr_max_kcal = bmr_min_kcal
WHERE bmr_min_kcal IS NOT NULL
  AND bmr_max_kcal IS NOT NULL
  AND bmr_min_kcal > bmr_max_kcal;
