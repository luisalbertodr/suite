SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'agenda_appointments'
ORDER BY ordinal_position;

SELECT a.id, a.client_name, a.description,
       a.start_time AT TIME ZONE 'Europe/Madrid' AS start_local,
       a.status, a.customer_id,
       c.name AS cust_name,
       coalesce(c.phone_mobile, c.phone, c.phone_home) AS phone
FROM agenda_appointments a
LEFT JOIN customers c ON c.id = a.customer_id
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND a.status IS DISTINCT FROM 'cancelled'
  AND (a.start_time AT TIME ZONE 'Europe/Madrid')::date
      = ((now() AT TIME ZONE 'Europe/Madrid')::date + 1)
ORDER BY a.start_time
LIMIT 30;
