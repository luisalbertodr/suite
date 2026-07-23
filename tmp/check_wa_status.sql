SELECT automation_type, success, left(coalesce(error,''),80) AS err,
       left(coalesce(message_preview,''),60) AS preview, created_at
FROM whatsapp_automation_send_log
ORDER BY created_at DESC LIMIT 15;

SELECT enabled, last_status, session_name, provider, left(base_url,60) AS base_url
FROM whatsapp_config;

SELECT a.client_name, a.appointment_date, a.start_time,
       coalesce(cu.phone_mobile, cu.phone, cu.phone_home) AS phone
FROM agenda_appointments a
LEFT JOIN customers cu ON cu.id = a.customer_id
WHERE a.company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
  AND a.appointment_date = (now() AT TIME ZONE 'Europe/Madrid')::date
  AND a.status IS DISTINCT FROM 'cancelled';
