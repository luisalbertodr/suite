SELECT type, media_mime_type, left(coalesce(media_url,''), 60) AS media_url,
       timestamp AT TIME ZONE 'Europe/Madrid' AS ts
FROM whatsapp_messages
WHERE waha_message_id = 'false_249774041247903@lid_3EB0F6C8AC8999BBE05B9B';
