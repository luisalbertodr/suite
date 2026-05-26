import type { AppointmentItemDraft } from '@/types/agenda';

type CatalogArticle = {
  id: string;
  codigo: string | null;
  descripcion: string;
  precio: number;
  duration_minutes: number;
  article_kind: string | null;
};

function normalizeText(value: string | null | undefined): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function buildCatalogLookups(articles: CatalogArticle[]) {
  const byCode = new Map<string, CatalogArticle>();
  const byDescription = new Map<string, CatalogArticle>();
  for (const article of articles) {
    if (article.codigo) byCode.set(String(article.codigo).toLowerCase(), article);
    byDescription.set(normalizeText(article.descripcion), article);
  }
  return { byCode, byDescription };
}

function isLegacyDunasoftServiceLabel(label: string): boolean {
  return /^\[\d{1,2}:\d{2}\]\s*\S+/.test(String(label || '').trim());
}

function extractLegacyServiceCode(label: string): string | null {
  const match = String(label || '').trim().match(/^\[\d{1,2}:\d{2}\]\s*(\S+)/);
  return match?.[1]?.trim() || null;
}

function articleForProduct(
  product: AppointmentItemDraft,
  byCode: Map<string, CatalogArticle>,
  byDescription: Map<string, CatalogArticle>,
  preferredCode?: string | null
): CatalogArticle | undefined {
  if (preferredCode) {
    const byPref = byCode.get(preferredCode.toLowerCase());
    if (byPref) return byPref;
  }
  const normalized = normalizeText(product.label);
  const byDesc = byDescription.get(normalized);
  if (byDesc) return byDesc;
  const codeMatch = String(product.label || '').trim().match(/^(\S+)\s*[-:]/);
  if (codeMatch?.[1]) return byCode.get(codeMatch[1].toLowerCase());
  return undefined;
}

function toServiceFromArticle(
  article: CatalogArticle,
  seed: AppointmentItemDraft,
  unitPriceFallback = 0
): AppointmentItemDraft {
  const code = article.codigo ? String(article.codigo) : '';
  const label = code ? `${code} - ${article.descripcion}` : article.descripcion;
  const duration = Math.max(0, Number(article.duration_minutes || 0)) || 30;
  const unitPrice =
    Math.max(0, Number(seed.unit_price ?? 0)) ||
    Math.max(0, Number(article.precio ?? 0)) ||
    Math.max(0, unitPriceFallback);
  const kind =
    String(article.article_kind || '').toLowerCase() === 'producto' ? 'product' : 'service';
  return {
    ...seed,
    kind,
    label,
    duration_minutes: duration,
    occupies_time: kind === 'service',
    unit_price: unitPrice,
    article_id: article.id,
    quantity: Math.max(1, Number(seed.quantity ?? 1)),
  };
}

function isLegacySyntheticDescription(text: string): boolean {
  return isLegacyDunasoftServiceLabel(text) || /\[\d{1,2}:\d{2}\]\s*\S+.*\[\d{1,2}:\d{2}\]/.test(String(text || '').trim());
}

/**
 * Repara citas importadas con el patrón antiguo:
 * 1 servicio "[HH:MM] código" + N productos con el nombre del artículo.
 */
export function repairLegacyDunasoftAppointmentItems(
  items: AppointmentItemDraft[],
  articles: CatalogArticle[]
): AppointmentItemDraft[] {
  if (items.length < 2) return items;

  const legacyService = items.find(
    (item) => item.kind === 'service' && isLegacyDunasoftServiceLabel(item.label)
  );
  const legacyProducts = items.filter((item) => item.kind === 'product');
  if (!legacyService || legacyProducts.length === 0) return items;

  const { byCode, byDescription } = buildCatalogLookups(articles);
  const firstCode = extractLegacyServiceCode(legacyService.label);
  const repaired: AppointmentItemDraft[] = [];
  let pendingCode = firstCode;

  for (const product of legacyProducts) {
    const article = articleForProduct(product, byCode, byDescription, pendingCode);
    pendingCode = null;
    if (article) {
      repaired.push(toServiceFromArticle(article, product, Number(product.unit_price ?? 0)));
      continue;
    }
    repaired.push({
      ...product,
      kind: 'service',
      duration_minutes: Math.max(0, Number(product.duration_minutes || 0)) || 30,
      occupies_time: true,
    });
  }

  const untouched = items.filter((item) => item !== legacyService && !legacyProducts.includes(item));
  return [...repaired, ...untouched];
}

export function normalizeLegacyAppointmentDescription(description: string): string {
  const value = String(description || '').trim();
  if (!value || isLegacySyntheticDescription(value)) return '';
  return value;
}
