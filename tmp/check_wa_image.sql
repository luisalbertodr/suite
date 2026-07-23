SELECT
  type,
  left(coalesce(body, ''), 40) AS body,
  left(coalesce(caption, ''), 40) AS caption,
  media_url IS NOT NULL AS has_media_url,
  left(coalesce(media_url, ''), 90) AS media_url_prefix,
  media_mime_type,
  media_filename,
  left(coalesce(waha_message_id, ''), 55) AS mid,
  timestamp AT TIME ZONE 'Europe/Madrid' AS ts_local,
  raw IS NOT NULL AS has_raw,
  CASE
    WHEN raw IS NULL THEN NULL
    ELSE left(raw::text, 120)
  END AS raw_prefix
FROM whatsapp_messages
WHERE (
  chat_id LIKE '%667435503%'
  OR from_jid LIKE '%667435503%'
)
  AND timestamp >= '2026-07-22 09:00+00'
  AND timestamp < '2026-07-22 10:15+00'
ORDER BY timestamp;
