SELECT company_id, appointment_reminders_enabled, appointment_reminder_day_before_enabled,
       appointment_reminder_hour_before_enabled, test_mode_enabled, test_phone,
       marketing_queue_hour_start, marketing_queue_hour_end,
       (appointment_reminder_templates IS NOT NULL AND appointment_reminder_templates <> '{}'::jsonb) AS has_templates
FROM whatsapp_automation_settings;
