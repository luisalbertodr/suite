UPDATE whatsapp_config
SET last_status = 'WORKING', last_status_at = now()
WHERE enabled = true;

SELECT last_status, last_status_at FROM whatsapp_config;
