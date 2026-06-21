-- Media de mensajes WhatsApp (imágenes, stickers, audio…) servida por URL pública.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-media',
  'whatsapp-media',
  true,
  15728640,
  ARRAY[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'video/mp4', 'video/3gpp',
    'audio/ogg', 'audio/mpeg', 'audio/mp4', 'audio/webm',
    'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "whatsapp_media_public_read" ON storage.objects;
CREATE POLICY "whatsapp_media_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'whatsapp-media');

DROP POLICY IF EXISTS "whatsapp_media_service_write" ON storage.objects;
CREATE POLICY "whatsapp_media_service_write"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'whatsapp-media')
  WITH CHECK (bucket_id = 'whatsapp-media');
