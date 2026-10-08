/** Public Metabase site URL (Vite). Empty = BI panel shows setup hint. */
export function getMetabaseSiteUrl(): string {
  const raw = (import.meta.env.VITE_METABASE_SITE_URL as string | undefined)?.trim() ?? '';
  return raw.replace(/\/+$/, '');
}

export function isMetabaseConfigured(): boolean {
  return getMetabaseSiteUrl().length > 0;
}
