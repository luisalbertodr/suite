SELECT id::text, fecha::text, left(coalesce(motivo_consulta,''),60) AS motivo,
       left(coalesce(observaciones,''),80) AS obs
FROM public.historial_clinico
WHERE customer_id = '765ddd01-74cf-404a-91bd-3910c1d53123'
ORDER BY fecha;
