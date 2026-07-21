-- Consultas importadas sin appointment_id
SELECT
  h.fecha::text AS fecha,
  c.name AS cliente,
  c.legacy_codcli AS codigo,
  h.motivo_consulta AS motivo,
  left(coalesce(h.tratamiento, ''), 120) AS tratamiento,
  h.id::text AS historial_id,
  c.id::text AS customer_id
FROM public.historial_clinico h
JOIN public.customers c ON c.id = h.customer_id
WHERE h.observaciones LIKE '%medicina_estetica_csv_v2%'
  AND h.appointment_id IS NULL
ORDER BY c.name, h.fecha;

-- Clientes creados en el import (sin legacy_codcli y creados hoy aprox, o por nombre del reporte)
-- Se rellenara desde el JSON del reporte.
