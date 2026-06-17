UPDATE whatsapp_automation_settings
SET marketing_queue_next_send_at = NULL,
    updated_at = now()
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
