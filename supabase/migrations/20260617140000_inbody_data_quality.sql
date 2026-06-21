-- Calidad InBody: columna data_quality + recálculo masivo de rangos y coherencia.

ALTER TABLE public.inbody_measurements
  ADD COLUMN IF NOT EXISTS data_quality jsonb;

COMMENT ON COLUMN public.inbody_measurements.data_quality IS
  'Validación de coherencia: status, needs_repeat, issues, hint y sesión de referencia.';

-- Idempotente: corrige PBFM_MIN/MAX importados como % sin convertir a kg.
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

-- Marca mediciones sospechosas y enlaza sesión de referencia fiable más cercana.
WITH issues AS (
  SELECT
    m.id,
    m.company_id,
    m.inbody_user_id,
    m.measured_at,
    m.weight_kg,
    m.body_fat_kg,
    m.pbf_pct,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN m.weight_kg IS NULL OR m.weight_kg <= 0 THEN 'missing_core_fields' END,
      CASE WHEN m.pbf_pct IS NULL AND m.body_fat_kg IS NULL THEN 'missing_core_fields' END,
      CASE WHEN m.weight_kg >= 40 AND m.pbf_pct > 0 AND m.pbf_pct < 8 THEN 'pbf_too_low' END,
      CASE WHEN m.pbf_pct > 60 THEN 'pbf_too_high' END,
      CASE WHEN m.weight_kg >= 40 AND m.body_fat_kg IS NOT NULL AND m.body_fat_kg / m.weight_kg < 0.06
        THEN 'body_fat_ratio_low' END,
      CASE WHEN m.weight_kg > 0 AND m.pbf_pct IS NOT NULL AND m.body_fat_kg IS NOT NULL
        AND ABS(m.pbf_pct - (m.body_fat_kg / m.weight_kg * 100)) > 8 THEN 'pbf_bfm_mismatch' END,
      CASE WHEN m.weight_kg IS NOT NULL AND m.ffm_kg IS NOT NULL AND m.body_fat_kg IS NOT NULL
        AND ABS(m.weight_kg - (m.ffm_kg + m.body_fat_kg)) > 4 THEN 'composition_sum_mismatch' END
    ], NULL) AS issue_arr
  FROM public.inbody_measurements m
),
flagged AS (
  SELECT
    i.*,
    (
      SELECT bool_or(x IN (
        'pbf_too_low', 'pbf_too_high', 'body_fat_ratio_low',
        'pbf_bfm_mismatch', 'composition_sum_mismatch', 'missing_core_fields'
      ))
      FROM unnest(i.issue_arr) AS x
    ) AS suspicious
  FROM issues i
),
good AS (
  SELECT f.id, f.company_id, f.inbody_user_id, f.measured_at, f.weight_kg, f.body_fat_kg, f.pbf_pct
  FROM flagged f
  WHERE NOT COALESCE(f.suspicious, false)
),
refs AS (
  SELECT
    f.id,
    (
      SELECT g.id
      FROM good g
      WHERE g.company_id = f.company_id
        AND g.inbody_user_id = f.inbody_user_id
      ORDER BY ABS(EXTRACT(EPOCH FROM (g.measured_at - f.measured_at)))
      LIMIT 1
    ) AS ref_id
  FROM flagged f
  WHERE COALESCE(f.suspicious, false)
),
quality AS (
  SELECT
    f.id,
    jsonb_build_object(
      'status', CASE WHEN COALESCE(f.suspicious, false) THEN 'suspicious' ELSE 'ok' END,
      'needs_repeat', COALESCE(f.suspicious, false),
      'issues', to_jsonb(f.issue_arr),
      'checked_at', to_char(timezone('utc', now()), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
      'reference_measurement_id', r.ref_id,
      'reference_measured_at', ref.measured_at,
      'hint', CASE
        WHEN r.ref_id IS NOT NULL THEN jsonb_build_object(
          'pbf_pct', ref.pbf_pct,
          'body_fat_kg', ref.body_fat_kg,
          'weight_kg', ref.weight_kg,
          'source', 'reference_measurement'
        )
        WHEN f.pbf_pct IS NOT NULL AND f.pbf_pct >= 8 AND f.pbf_pct <= 60 AND f.weight_kg > 0
          AND 'pbf_bfm_mismatch' = ANY(f.issue_arr) THEN jsonb_build_object(
          'pbf_pct', f.pbf_pct,
          'body_fat_kg', f.weight_kg * f.pbf_pct / 100.0,
          'weight_kg', f.weight_kg,
          'source', 'pbf_derived'
        )
        ELSE NULL
      END
    ) AS dq
  FROM flagged f
  LEFT JOIN refs r ON r.id = f.id
  LEFT JOIN public.inbody_measurements ref ON ref.id = r.ref_id
)
UPDATE public.inbody_measurements m
SET data_quality = q.dq
FROM quality q
WHERE m.id = q.id;

CREATE INDEX IF NOT EXISTS idx_inbody_measurements_data_quality_needs_repeat
  ON public.inbody_measurements ((data_quality->>'needs_repeat'))
  WHERE (data_quality->>'needs_repeat') = 'true';
