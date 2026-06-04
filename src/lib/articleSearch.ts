import type { AppointmentItemKind } from '@/types/agenda';
import {
  articleMatchesAppointmentItemKind,
  normalizeArticleKind,
} from '@/lib/appointmentArticleKind';

/** Mínimo de caracteres para disparar búsqueda remota de artículos. */
export const ARTICLE_SEARCH_MIN_CHARS = 3;

export type ArticlePickerKind = AppointmentItemKind | 'all';

export function articleMatchesPickerKind(
  itemKind: ArticlePickerKind,
  article: { article_kind: string | null },
): boolean {
  if (itemKind === 'all') return true;
  return articleMatchesAppointmentItemKind(itemKind, article);
}

export function isArticleSearchQueryReady(query: string): boolean {
  return query.trim().length >= ARTICLE_SEARCH_MIN_CHARS;
}

export { normalizeArticleKind };
