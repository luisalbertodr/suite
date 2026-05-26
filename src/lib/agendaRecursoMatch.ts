import type { AppointmentItemDraft } from '@/types/agenda';

export type RecursoCatalogEntry = {


  id: string;
  nombre: string;
  color?: string | null;
  tipo?: string | null;
  match_keywords?: string | null;
};

export const RECURSO_COLOR_PALETTE = [
  '#EF4444',
  '#F59E0B',
  '#10B981',
  '#3B82F6',
  '#8B5CF6',
  '#EC4899',
  '#6366F1',
  '#14B8A6',
  '#F97316',
  '#84CC16',
];

const DEFAULT_COLOR_BY_RESOURCE_NAME: Record<string, string> = {
  cera: '#F59E0B',
  inbody: '#10B981',
  indiba: '#8B5CF6',
  laser: '#EF4444',
  lpg: '#EC4899',
};

const DEFAULT_KEYWORDS_BY_RESOURCE_NAME: Record<string, string> = {
  cera: 'cera,wax,depilacion cera',
  inbody: 'inbody,in body,composicion corporal',
  indiba: 'indiba,radiofrecuencia,capacitiva,resistiva',
  laser: 'laser,láser,ipl,diodo,lumbar,dorsal,axila,pierna',
  lpg: 'lpg,endermologie,endermologie,maderoterapia',
};

export function normalizeMatchText(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function parseMatchKeywords(raw: string | null | undefined): string[] {
  return String(raw || '')
    .split(/[,;|]+/)
    .map((k) => normalizeMatchText(k))
    .filter(Boolean);
}

export function suggestRecursoColor(nombre: string): string {
  const n = normalizeMatchText(nombre);
  for (const [key, color] of Object.entries(DEFAULT_COLOR_BY_RESOURCE_NAME)) {
    if (n.includes(key)) return color;
  }
  return '#3B82F6';
}

export function suggestRecursoKeywords(nombre: string): string {
  const n = normalizeMatchText(nombre);
  for (const [key, keywords] of Object.entries(DEFAULT_KEYWORDS_BY_RESOURCE_NAME)) {
    if (n.includes(key)) return keywords;
  }
  const base = normalizeMatchText(nombre);
  return base ? base.replace(/\s+/g, ',') : '';
}

export function resolveRecursoColor(entry: Pick<RecursoCatalogEntry, 'nombre' | 'color'>): string {
  const configured = String(entry.color || '').trim();
  if (/^#[0-9A-Fa-f]{6}$/.test(configured)) return configured;
  return suggestRecursoColor(entry.nombre);
}

function keywordsForRecurso(entry: RecursoCatalogEntry): string[] {
  const fromConfig = parseMatchKeywords(entry.match_keywords);
  if (fromConfig.length) return fromConfig;
  const fromNombre = parseMatchKeywords(suggestRecursoKeywords(entry.nombre));
  if (fromNombre.length) return fromNombre;
  const name = normalizeMatchText(entry.nombre);
  return name ? [name] : [];
}

/**
 * Detecta el recurso cuyo nombre o palabras clave aparecen en la etiqueta del servicio.
 * Gana la coincidencia más específica (keyword más larga).
 */
export function matchRecursoForServiceLabel(
  label: string,
  recursos: RecursoCatalogEntry[]
): RecursoCatalogEntry | null {
  const normalizedLabel = normalizeMatchText(label);
  if (!normalizedLabel || !recursos.length) return null;

  let best: { entry: RecursoCatalogEntry; score: number } | null = null;

  for (const entry of recursos) {
    if (!entry.id) continue;
    const candidates = keywordsForRecurso(entry);
    const resourceName = normalizeMatchText(entry.nombre);
    if (resourceName && !candidates.includes(resourceName)) {
      candidates.unshift(resourceName);
    }

    for (const keyword of candidates) {
      if (!keyword || keyword.length < 2) continue;
      if (!normalizedLabel.includes(keyword)) continue;
      const score = keyword.length;
      if (!best || score > best.score) {
        best = { entry, score };
      }
    }
  }

  return best?.entry ?? null;
}

export type ArticleResourceHint = {
  familia?: string | null;
  recurso_id?: string | null;
};

/**
 * Prioridad: recurso explícito del ítem → recurso del artículo → nombre del servicio → familia.
 */
export function matchRecursoForItem(
  item: Pick<AppointmentItemDraft, 'label' | 'recurso_id' | 'article_id'>,
  recursos: RecursoCatalogEntry[],
  articleHint?: ArticleResourceHint | null
): RecursoCatalogEntry | null {
  if (item.recurso_id) {
    return recursos.find((r) => r.id === item.recurso_id) ?? null;
  }
  if (articleHint?.recurso_id) {
    return recursos.find((r) => r.id === articleHint.recurso_id) ?? null;
  }
  const byLabel = matchRecursoForServiceLabel(item.label, recursos);
  if (byLabel) return byLabel;
  if (articleHint?.familia) {
    return matchRecursoForServiceLabel(articleHint.familia, recursos);
  }
  return null;
}

export function autoAssignItemRecurso(
  item: AppointmentItemDraft,
  recursos: RecursoCatalogEntry[],
  articleHint?: ArticleResourceHint | null
): string | null {
  if (item.recurso_id) return item.recurso_id;
  return matchRecursoForItem(item, recursos, articleHint)?.id ?? null;
}

export function toRecursoCatalogEntries(
  rows: Array<{
    id: string;
    nombre: string;
    color?: string | null;
    tipo?: string | null;
    match_keywords?: string | null;
  }>
): RecursoCatalogEntry[] {
  return (rows || [])
    .filter((r) => r.id && r.nombre)
    .map((r) => ({
      id: String(r.id),
      nombre: String(r.nombre),
      color: r.color ?? null,
      tipo: r.tipo ?? null,
      match_keywords: r.match_keywords ?? null,
    }));
}
