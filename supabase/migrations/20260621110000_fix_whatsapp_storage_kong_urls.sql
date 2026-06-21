-- URLs de Storage guardadas con host interno del contenedor (http://kong:8000).

UPDATE whatsapp_messages
SET media_url = regexp_replace(
  media_url,
  '^https?://[^/]+',
  'https://supabase.lipoout.com'
)
WHERE media_url LIKE '%/storage/v1/object/public/whatsapp-media/%'
  AND (
    media_url LIKE '%kong:%'
    OR media_url LIKE '%localhost%'
    OR media_url LIKE '%192.168.%'
  );

UPDATE whatsapp_chats
SET profile_picture_url = regexp_replace(
  profile_picture_url,
  '^https?://[^/]+',
  'https://supabase.lipoout.com'
)
WHERE profile_picture_url LIKE '%/storage/v1/object/public/whatsapp-avatars/%'
  AND (
    profile_picture_url LIKE '%kong:%'
    OR profile_picture_url LIKE '%localhost%'
    OR profile_picture_url LIKE '%192.168.%'
  );
