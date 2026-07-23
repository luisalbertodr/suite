SELECT m.id, m.measured_at, m.device, m.source, m.weight_kg,
  m.bone_mass_kg IS NOT NULL AS has_bone,
  left(c.name, 40) AS customer
FROM inbody_measurements m
LEFT JOIN customers c ON c.id = m.customer_id
WHERE c.name ILIKE '%gemma%'
ORDER BY m.measured_at DESC
LIMIT 20;
