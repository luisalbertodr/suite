-- Completar medición Gemma (53 kg) con composición corregida del hex 0x25
-- + segmentales/impedancias del informe Renpho (misma sesión física).
-- Perfil Suite correcto: 153 cm / 33 años (no usar 170/48 del perfil Renpho ajeno).

UPDATE inbody_measurements m
SET
  height_cm = 153,
  age_years = 33,
  sex = 'F',
  weight_kg = 53,
  pbf_pct = 12.1,
  body_fat_kg = 6.43,
  smm_kg = 25.60,
  slm_kg = 43.55,
  bone_mass_kg = 3.02,
  ffm_kg = 46.57,
  body_water_pct = 64.1,
  tbw_kg = 33.99,
  protein_mass_kg = 9.56,
  protein_pct = 18.0,
  bmi = 22.64,
  subcutaneous_fat_pct = 8.6,
  visceral_fat_index = 1,
  segmental_lean = jsonb_build_object(
    'left_arm', jsonb_build_object('kg', 2.32),
    'right_arm', jsonb_build_object('kg', 2.36),
    'trunk', jsonb_build_object('kg', 20.17),
    'left_leg', jsonb_build_object('kg', 7.54),
    'right_leg', jsonb_build_object('kg', 7.63)
  ),
  segmental_fat = jsonb_build_object(
    'left_arm', jsonb_build_object('kg', 0.28),
    'right_arm', jsonb_build_object('kg', 0.26),
    'trunk', jsonb_build_object('kg', 3.21),
    'left_leg', jsonb_build_object('kg', 1.34),
    'right_leg', jsonb_build_object('kg', 1.32)
  ),
  impedance = jsonb_build_object(
    '20khz', jsonb_build_object(
      'right_arm', 375.5,
      'left_arm', 388.4,
      'trunk', 22.1,
      'right_leg', 302.0,
      'left_leg', 289.4
    ),
    '100khz', jsonb_build_object(
      'right_arm', 341.0,
      'left_arm', 354.5,
      'trunk', 18.0,
      'right_leg', 274.9,
      'left_leg', 273.8
    )
  ),
  raw_payload = coalesce(m.raw_payload, '{}'::jsonb) || jsonb_build_object(
    'corrected_at', now(),
    'correction', 'ffm_from_hex + renpho_segmentals_impedances',
    'fat_source', 'from_ffm',
    'note', 'Segmentales/Z del informe Renpho; composición global del hex Suite (perfil 153cm/33y)'
  ),
  data_quality = jsonb_build_object(
    'status', 'ok',
    'checked_at', now(),
    'needs_repeat', false,
    'issues', '[]'::jsonb
  ),
  updated_at = now()
FROM customers c
WHERE m.customer_id = c.id
  AND c.name ILIKE 'Gemma Suarez Gonzalez'
  AND m.weight_kg = 53
  AND m.measured_at > now() - interval '1 day'
RETURNING m.id, m.weight_kg, m.pbf_pct, m.smm_kg, m.slm_kg, m.body_water_pct,
          m.segmental_lean, m.impedance;
