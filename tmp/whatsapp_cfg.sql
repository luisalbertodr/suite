SELECT base_url, session_name, enabled, last_status, left(api_key,8) AS key_prefix, default_country_code
FROM whatsapp_config
WHERE company_id = '5d72535b-4e2c-4a5b-9900-e6c5a85f2ce4';
