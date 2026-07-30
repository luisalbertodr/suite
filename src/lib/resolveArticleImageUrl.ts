/** Base URL pública para fotos de Style (directorio Fotografias). */
export const STYLE_PHOTOS_BASE_URL = (
  (import.meta.env.VITE_STYLE_PHOTOS_BASE_URL as string | undefined) ?? '/style-fotos'
).replace(/\/+$/, '');

export type ArticleImageSource = {
  foto_url?: string | null;
  legacy_photo_path?: string | null;
};

function legacyPhotoFilename(legacyPhotoPath: string): string | null {
  const normalized = legacyPhotoPath.trim().replace(/\\/g, '/');
  if (!normalized) return null;
  const filename = normalized.split('/').filter(Boolean).pop();
  return filename?.trim() || null;
}

/** Devuelve la URL de imagen del artículo: Supabase Storage o foto legacy de Style. */
export function resolveArticleImageUrl(article: ArticleImageSource): string | null {
  const uploaded = article.foto_url?.trim();
  if (uploaded) return uploaded;

  const legacy = article.legacy_photo_path?.trim();
  if (!legacy) return null;

  const filename = legacyPhotoFilename(legacy);
  if (!filename) return null;

  return `${STYLE_PHOTOS_BASE_URL}/${encodeURIComponent(filename)}`;
}
