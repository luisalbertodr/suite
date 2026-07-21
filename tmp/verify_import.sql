SELECT count(*) AS consultas_import_v2
FROM public.historial_clinico
WHERE observaciones LIKE '%medicina_estetica_csv_v2%';

SELECT count(*) AS con_cita
FROM public.historial_clinico
WHERE observaciones LIKE '%medicina_estetica_csv_v2%'
  AND appointment_id IS NOT NULL;

SELECT customer_id::text, count(*) AS visitas
FROM public.historial_clinico
WHERE observaciones LIKE '%medicina_estetica_csv_v2%'
GROUP BY 1
ORDER BY 2 DESC
LIMIT 8;
