-- Duplicados: mismo cliente + misma fecha (tipo consulta), típico doble import medicina
WITH dups AS (
  SELECT customer_id, fecha, count(*) AS n,
         array_agg(id ORDER BY created_at) AS ids,
         array_agg(left(coalesce(observaciones,''), 90) ORDER BY created_at) AS obs,
         array_agg(created_at ORDER BY created_at) AS created
  FROM historial_clinico
  WHERE tipo = 'consulta' OR tipo IS NULL
  GROUP BY customer_id, fecha
  HAVING count(*) > 1
)
SELECT d.fecha, d.n, c.name, c.legacy_codcli,
       d.ids, d.obs
FROM dups d
JOIN customers c ON c.id = d.customer_id
ORDER BY d.fecha DESC, c.name
LIMIT 80;

SELECT count(*) AS dup_groups,
       sum(n) AS total_rows_in_dup_groups,
       sum(n - 1) AS rows_to_delete_if_keep_one
FROM (
  SELECT customer_id, fecha, count(*) AS n
  FROM historial_clinico
  WHERE tipo = 'consulta' OR tipo IS NULL
  GROUP BY customer_id, fecha
  HAVING count(*) > 1
) x;

-- Solo medicina import (doble clave v1/v2)
SELECT count(*) AS medicina_dup_groups
FROM (
  SELECT customer_id, fecha
  FROM historial_clinico
  WHERE observaciones LIKE '%Fichas medicina.csv%'
  GROUP BY customer_id, fecha
  HAVING count(*) > 1
) x;
