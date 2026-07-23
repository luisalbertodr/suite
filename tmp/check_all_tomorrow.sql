SELECT id, name FROM companies ORDER BY name;

-- Citas de mañana con teléfono real por empresa
SELECT c.name AS company,
       count(*) AS apts,
       count(*) FILTER (
         WHERE coalesce(nullif(cu.phone_mobile,''), nullif(cu.phone,''), nullif(cu.phone_home,'')) IS NOT NULL
       ) AS with_phone
FROM agenda_appointments a
JOIN companies c ON c.id = a.company_id
LEFT JOIN customers cu ON cu.id = a.customer_id
WHERE a.status IS DISTINCT FROM 'cancelled'
  AND a.appointment_date = ((now() AT TIME ZONE 'Europe/Madrid')::date + 1)
GROUP BY c.name
ORDER BY with_phone DESC, apts DESC;

-- Muestra citas con teléfono (cualquier empresa)
SELECT co.name AS company, a.client_name, a.appointment_date, a.start_time,
       coalesce(cu.phone_mobile, cu.phone, cu.phone_home) AS phone,
       left(coalesce(a.description,''), 40) AS descr
FROM agenda_appointments a
JOIN companies co ON co.id = a.company_id
LEFT JOIN customers cu ON cu.id = a.customer_id
WHERE a.status IS DISTINCT FROM 'cancelled'
  AND a.appointment_date = ((now() AT TIME ZONE 'Europe/Madrid')::date + 1)
  AND coalesce(nullif(cu.phone_mobile,''), nullif(cu.phone,''), nullif(cu.phone_home,'')) IS NOT NULL
ORDER BY a.start_time
LIMIT 25;

SELECT company_id, enabled, last_status, provider
FROM whatsapp_config
WHERE enabled = true;
