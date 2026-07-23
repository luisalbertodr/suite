-- Casos con >2 en mismo día: ¿contenido distinto?
SELECT c.name, h.fecha, h.id,
       left(coalesce(h.motivo_consulta,''), 60) AS motivo,
       left(coalesce(h.tratamiento,''), 80) AS tto,
       left(coalesce(h.observaciones,''), 90) AS obs,
       length(coalesce(h.tratamiento,'')) AS tto_len,
       h.appointment_id IS NOT NULL AS has_appt
FROM historial_clinico h
JOIN customers c ON c.id = h.customer_id
WHERE (c.name, h.fecha) IN (
  SELECT c2.name, h2.fecha
  FROM historial_clinico h2
  JOIN customers c2 ON c2.id = h2.customer_id
  WHERE h2.observaciones LIKE '%Fichas medicina.csv%'
  GROUP BY c2.name, h2.fecha
  HAVING count(*) > 2
)
ORDER BY c.name, h.fecha, h.created_at;
