SELECT a.id, a.client_name, left(coalesce(a.description,''), 60) AS description,
       a.start_time AS start_raw, a.status, a.customer_id,
       c.name AS cust_name,
       coalesce(c.phone_mobile, c.phone, c.phone_home) AS phone
FROM agenda_appointments a
LEFT JOIN customers c ON c.id = a.customer_id
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND a.status IS DISTINCT FROM 'cancelled'
  AND a.appointment_date = ((now() AT TIME ZONE 'Europe/Madrid')::date + 1)
ORDER BY a.start_time
LIMIT 40;

SELECT count(*) AS tomorrow_with_phone
FROM agenda_appointments a
LEFT JOIN customers c ON c.id = a.customer_id
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND a.status IS DISTINCT FROM 'cancelled'
  AND a.appointment_date = ((now() AT TIME ZONE 'Europe/Madrid')::date + 1)
  AND coalesce(nullif(c.phone_mobile,''), nullif(c.phone,''), nullif(c.phone_home,''), nullif(a.client_name,'')) IS NOT NULL;
