SELECT last_status, me_jid, last_status_at, enabled FROM whatsapp_config;

SELECT appointment_reminder_send_hour_start,
       marketing_queue_hour_start, marketing_queue_hour_end,
       appointment_reminders_enabled,
       appointment_reminder_day_before_enabled,
       appointment_reminder_hour_before_enabled
FROM whatsapp_automation_settings
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
