-- Avatares de chats WhatsApp (contactos y grupos) persistidos desde Waha.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'whatsapp-avatars',
  'whatsapp-avatars',
  true,
  524288,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "whatsapp_avatars_public_read" ON storage.objects;
CREATE POLICY "whatsapp_avatars_public_read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'whatsapp-avatars');

DROP POLICY IF EXISTS "whatsapp_avatars_service_write" ON storage.objects;
CREATE POLICY "whatsapp_avatars_service_write"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'whatsapp-avatars')
  WITH CHECK (bucket_id = 'whatsapp-avatars');
