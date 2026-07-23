-- Agenda hoy/mañana en todas las empresas (muestra)
SELECT co.name, a.appointment_date, count(*) AS n,
  count(*) FILTER (
    WHERE coalesce(nullif(cu.phone_mobile,''), nullif(cu.phone,''), nullif(cu.phone_home,'')) IS NOT NULL
  ) AS with_phone
FROM agenda_appointments a
JOIN companies co ON co.id = a.company_id
LEFT JOIN customers cu ON cu.id = a.customer_id
WHERE a.status IS DISTINCT FROM 'cancelled'
  AND a.appointment_date BETWEEN (now() AT TIME ZONE 'Europe/Madrid')::date
                             AND ((now() AT TIME ZONE 'Europe/Madrid')::date + 2)
GROUP BY co.name, a.appointment_date
ORDER BY a.appointment_date, with_phone DESC;

-- Settings por empresa (nombre)
SELECT c.name, s.appointment_reminders_enabled, s.appointment_reminder_day_before_enabled,
       s.appointment_reminder_hour_before_enabled, s.test_mode_enabled
FROM whatsapp_automation_settings s
JOIN companies c ON c.id = s.company_id
ORDER BY s.appointment_reminders_enabled DESC, c.name;

-- Formato real de start_time / appointment_date
SELECT appointment_date, start_time, end_time, client_name, customer_id
FROM agenda_appointments
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4'
ORDER BY appointment_date DESC, start_time
LIMIT 10;
