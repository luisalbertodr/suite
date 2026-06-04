import type { AppointmentItemKind } from '@/types/agenda';

/** Duración por defecto al añadir un servicio en nueva cita. */
export const DEFAULT_APPOINTMENT_SERVICE_MINUTES = 15;

export const normalizeArticleKind = (value: string | null | undefined): string =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

export function articleMatchesAppointmentItemKind(
  itemKind: AppointmentItemKind,
  article: { article_kind: string | null },
): boolean {
  const k = normalizeArticleKind(article.article_kind);
  if (itemKind === 'service') return k.includes('service') || k.includes('servicio');
  if (itemKind === 'product') {
    return (
      k.includes('product') ||
      k.includes('producto') ||
      k.includes('standard') ||
      k.includes('textil') ||
      k.includes('calzado')
    );
  }
  if (itemKind === 'bonus') return k.includes('bonus') || k.includes('bono');
  return true;
}

/** Escapa % y _ para filtros ilike de PostgREST. */
export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}
