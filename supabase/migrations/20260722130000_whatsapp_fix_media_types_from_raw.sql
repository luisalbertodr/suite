-- Corrige mensajes de media guardados como type=text (OpenWA sync/webhook débil).
-- Recupera tipo/mime/url desde raw Baileys (_data.message.*Message).

UPDATE public.whatsapp_messages
SET
  type = 'image',
  media_mime_type = COALESCE(
    NULLIF(media_mime_type, ''),
    raw #>> '{_data,message,imageMessage,mimetype}',
    'image/jpeg'
  ),
  media_url = COALESCE(
    NULLIF(media_url, ''),
    raw #>> '{_data,message,imageMessage,url}'
  ),
  media_size = COALESCE(
    media_size,
    NULLIF(raw #>> '{_data,message,imageMessage,fileLength}', '')::bigint
  ),
  caption = COALESCE(
    NULLIF(caption, ''),
    raw #>> '{_data,message,imageMessage,caption}'
  )
WHERE type IN ('text', 'chat', 'unknown')
  AND raw -> '_data' -> 'message' ? 'imageMessage';

UPDATE public.whatsapp_messages
SET
  type = 'video',
  media_mime_type = COALESCE(
    NULLIF(media_mime_type, ''),
    raw #>> '{_data,message,videoMessage,mimetype}',
    'video/mp4'
  ),
  media_url = COALESCE(
    NULLIF(media_url, ''),
    raw #>> '{_data,message,videoMessage,url}'
  ),
  caption = COALESCE(
    NULLIF(caption, ''),
    raw #>> '{_data,message,videoMessage,caption}'
  )
WHERE type IN ('text', 'chat', 'unknown')
  AND raw -> '_data' -> 'message' ? 'videoMessage';

UPDATE public.whatsapp_messages
SET
  type = CASE
    WHEN COALESCE(raw #>> '{_data,message,audioMessage,ptt}', '') IN ('true', 't', '1')
      THEN 'voice'
    ELSE 'audio'
  END,
  media_mime_type = COALESCE(
    NULLIF(media_mime_type, ''),
    raw #>> '{_data,message,audioMessage,mimetype}',
    'audio/ogg'
  ),
  media_url = COALESCE(
    NULLIF(media_url, ''),
    raw #>> '{_data,message,audioMessage,url}'
  )
WHERE type IN ('text', 'chat', 'unknown')
  AND raw -> '_data' -> 'message' ? 'audioMessage';

UPDATE public.whatsapp_messages
SET
  type = 'sticker',
  media_mime_type = COALESCE(
    NULLIF(media_mime_type, ''),
    raw #>> '{_data,message,stickerMessage,mimetype}',
    'image/webp'
  ),
  media_url = COALESCE(
    NULLIF(media_url, ''),
    raw #>> '{_data,message,stickerMessage,url}'
  )
WHERE type IN ('text', 'chat', 'unknown')
  AND raw -> '_data' -> 'message' ? 'stickerMessage';

UPDATE public.whatsapp_messages
SET
  type = 'document',
  media_mime_type = COALESCE(
    NULLIF(media_mime_type, ''),
    raw #>> '{_data,message,documentMessage,mimetype}',
    'application/octet-stream'
  ),
  media_url = COALESCE(
    NULLIF(media_url, ''),
    raw #>> '{_data,message,documentMessage,url}'
  ),
  media_filename = COALESCE(
    NULLIF(media_filename, ''),
    raw #>> '{_data,message,documentMessage,fileName}'
  ),
  caption = COALESCE(
    NULLIF(caption, ''),
    raw #>> '{_data,message,documentMessage,caption}'
  )
WHERE type IN ('text', 'chat', 'unknown')
  AND raw -> '_data' -> 'message' ? 'documentMessage';

-- Variante con message en la raíz (WAHA / envelope).
UPDATE public.whatsapp_messages
SET
  type = 'image',
  media_mime_type = COALESCE(
    NULLIF(media_mime_type, ''),
    raw #>> '{message,imageMessage,mimetype}',
    'image/jpeg'
  ),
  media_url = COALESCE(
    NULLIF(media_url, ''),
    raw #>> '{message,imageMessage,url}'
  )
WHERE type IN ('text', 'chat', 'unknown')
  AND raw -> 'message' ? 'imageMessage';
