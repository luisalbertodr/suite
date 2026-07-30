export type ArticleImageSource = {
  foto_url?: string | null;
};

/** Suite lee las fotos exclusivamente desde Supabase Storage (foto_url). */
export function resolveArticleImageUrl(article: ArticleImageSource): string | null {
  const uploaded = article.foto_url?.trim();
  return uploaded || null;
}
