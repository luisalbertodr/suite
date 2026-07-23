SELECT
  type,
  media_url,
  media_mime_type,
  body,
  raw->'type' AS raw_type,
  raw->'hasMedia' AS has_media,
  raw->'_data'->'message' ? 'imageMessage' AS has_image_msg,
  raw->'message' ? 'imageMessage' AS has_image_msg_top,
  left(raw::text, 800) AS raw_start
FROM whatsapp_messages
WHERE waha_message_id = 'false_249774041247903@lid_3EB0F6C8AC8999BBE05B9B';
