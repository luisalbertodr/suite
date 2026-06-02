import { supabase } from '@/lib/supabase';

export type CatalogArticleRef = {
  id: string;
  codigo: string | null;
  familia: string | null;
  descripcion: string;
  billing_company_id: string | null;
  company_id: string;
};

/** Código al inicio de la descripción de línea (ej. "00259 - Mesoterapia"). */
export function parseInvoiceLineArticleCode(description: string): string | null {
  const d = description.trim();
  if (!d) return null;
  const m = d.match(/^([A-Za-z0-9._-]+)\s*[-–—]\s+/);
  return m ? m[1].trim().toUpperCase() : null;
}

function normalizeCodigoKey(codigo: string): string {
  return codigo.trim().toUpperCase();
}

export function buildArticleCodigoIndex(
  articles: CatalogArticleRef[],
): Map<string, CatalogArticleRef> {
  const index = new Map<string, CatalogArticleRef>();
  for (const art of articles) {
    if (!art.codigo) continue;
    const key = normalizeCodigoKey(art.codigo);
    if (!index.has(key)) index.set(key, art);
    const stripped = key.replace(/^0+/, '') || key;
    if (!index.has(stripped)) index.set(stripped, art);
  }
  return index;
}

export function resolveLineArticle(
  description: string,
  byCodigo: Map<string, CatalogArticleRef>,
): CatalogArticleRef | null {
  const code = parseInvoiceLineArticleCode(description);
  if (!code) return null;
  return byCodigo.get(code) ?? byCodigo.get(code.replace(/^0+/, '') || code) ?? null;
}

/** Por cada familia seleccionada, códigos de artículos con ese nombre de familia en catálogo. */
export function buildFamilyCodigoSets(
  articles: CatalogArticleRef[],
  familiaNames: string[],
): Map<string, Set<string>> {
  const wanted = new Set(familiaNames);
  const sets = new Map<string, Set<string>>();
  for (const name of familiaNames) sets.set(name, new Set());

  for (const art of articles) {
    const fam = art.familia?.trim();
    if (!fam || !wanted.has(fam)) continue;
    const set = sets.get(fam)!;
    if (art.codigo) {
      set.add(normalizeCodigoKey(art.codigo));
      const stripped = normalizeCodigoKey(art.codigo).replace(/^0+/, '') || normalizeCodigoKey(art.codigo);
      set.add(stripped);
    }
  }
  return sets;
}

export function lineMatchesFamiliaFilter(
  description: string,
  byCodigo: Map<string, CatalogArticleRef>,
  familiaNames: string[],
  familyCodigoSets: Map<string, Set<string>>,
  options?: {
    /** Factura emitida por una empresa del ámbito (p. ej. Medicina). */
    invoiceCompanyId?: string;
    billingCompanyIds?: string[];
  },
): boolean {
  if (familiaNames.length === 0) return true;

  const art = resolveLineArticle(description, byCodigo);
  if (art?.familia && familiaNames.includes(art.familia.trim())) return true;

  const code = parseInvoiceLineArticleCode(description);
  if (!code) return false;

  const keys = [code, code.replace(/^0+/, '') || code];
  for (const fam of familiaNames) {
    const set = familyCodigoSets.get(fam);
    if (!set) continue;
    if (keys.some((k) => set.has(k))) return true;
  }

  // Facturas emitidas por la empresa del informe con líneas legacy (IMPORTADO / sin familia
  // alineada al catálogo fiscal): incluir si el código existe en catálogo.
  const scope = options?.billingCompanyIds ?? [];
  const invCo = options?.invoiceCompanyId;
  if (
    scope.length > 0 &&
    invCo &&
    scope.includes(invCo) &&
    art
  ) {
    return true;
  }

  return false;
}

export type ArticleFilterTerms = {
  ids: Set<string>;
  codigos: Set<string>;
  descripcionNeedles: string[];
};

export function buildArticleFilterTerms(
  articuloIds: string[],
  articles: CatalogArticleRef[],
): ArticleFilterTerms {
  const ids = new Set(articuloIds);
  const codigos = new Set<string>();
  const descripcionNeedles: string[] = [];

  for (const art of articles) {
    if (!ids.has(art.id)) continue;
    if (art.codigo) {
      codigos.add(normalizeCodigoKey(art.codigo));
      const stripped = normalizeCodigoKey(art.codigo).replace(/^0+/, '') || normalizeCodigoKey(art.codigo);
      codigos.add(stripped);
    }
    const desc = art.descripcion?.trim();
    if (desc && desc.length >= 3) {
      descripcionNeedles.push(desc.toLowerCase());
    }
  }

  return { ids, codigos, descripcionNeedles };
}

export function lineMatchesArticleFilter(
  description: string,
  byCodigo: Map<string, CatalogArticleRef>,
  terms: ArticleFilterTerms,
): boolean {
  if (terms.ids.size === 0) return true;

  const resolved = resolveLineArticle(description, byCodigo);
  if (resolved?.id && terms.ids.has(resolved.id)) return true;

  const code = parseInvoiceLineArticleCode(description);
  if (code) {
    const keys = [code, code.replace(/^0+/, '') || code];
    if (keys.some((k) => terms.codigos.has(k))) return true;
  }

  const descLower = description.toLowerCase();
  return terms.descripcionNeedles.some((needle) => descLower.includes(needle));
}

export async function fetchCatalogArticlesForMatching(
  catalogCompanyId: string,
): Promise<CatalogArticleRef[]> {
  const { data, error } = await supabase
    .from('articles')
    .select('id, codigo, familia, descripcion, billing_company_id, company_id')
    .eq('company_id', catalogCompanyId);
  if (error) throw error;
  return (data ?? []) as CatalogArticleRef[];
}
