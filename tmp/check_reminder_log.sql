SELECT automation_type, reference_id, success, intended_phone, sent_to_phone,
       left(coalesce(error, ''), 100) AS err,
       created_at AT TIME ZONE 'Europe/Madrid' AS ts
FROM whatsapp_automation_send_log
WHERE automation_type LIKE 'appointment%' OR automation_type = 'test_manual'
ORDER BY created_at DESC
LIMIT 25;
