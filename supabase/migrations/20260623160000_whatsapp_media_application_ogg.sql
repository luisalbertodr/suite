-- OpenWA persiste audios salientes como audio/ogg; permitir también application/ogg en el bucket.

UPDATE storage.buckets
SET allowed_mime_types = (
  SELECT array_agg(DISTINCT t)
  FROM unnest(
    COALESCE(allowed_mime_types, ARRAY[]::text[]) || ARRAY['application/ogg']
  ) AS t
)
WHERE id = 'whatsapp-media';
