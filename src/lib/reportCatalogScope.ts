import { supabase } from '@/lib/supabase';

/** Empresa fiscal efectiva de una familia (NULL = empresa del catálogo). */
export function resolveFamilyBillingCompanyId(
  family: { billing_company_id?: string | null; company_id: string },
): string {
  return family.billing_company_id ?? family.company_id;
}

/** Empresa fiscal efectiva de un artículo (NULL = hereda familia o catálogo). */
export function resolveArticleBillingCompanyId(
  article: { billing_company_id?: string | null; company_id: string },
  familyBillingCompanyId: string,
): string {
  return article.billing_company_id ?? familyBillingCompanyId;
}

export function familyMatchesBillingScope(
  family: { company_id: string; billing_company_id?: string | null },
  catalogCompanyId: string,
  billingCompanyIds: string[],
): boolean {
  if (family.company_id !== catalogCompanyId) return false;
  if (billingCompanyIds.length === 0) return false;
  const billingId = resolveFamilyBillingCompanyId(family);
  return billingCompanyIds.includes(billingId);
}

export async function fetchReportFamilyNames(
  catalogCompanyId: string,
  billingCompanyIds: string[],
): Promise<string[]> {
  if (!catalogCompanyId || billingCompanyIds.length === 0) return [];

  const { data, error } = await supabase
    .from('article_families')
    .select('name, company_id, billing_company_id')
    .eq('company_id', catalogCompanyId)
    .order('name');
  if (error) throw error;

  return (data ?? [])
    .filter((f) =>
      familyMatchesBillingScope(
        f as { company_id: string; billing_company_id?: string | null },
        catalogCompanyId,
        billingCompanyIds,
      ),
    )
    .map((f) => f.name as string);
}

export type ReportCatalogArticle = {
  id: string;
  codigo: string | null;
  descripcion: string;
};

/** Nombre de familia → empresa fiscal emisora (solo familias en el ámbito del informe). */
export async function fetchFamilyBillingByName(
  catalogCompanyId: string,
  billingCompanyIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (!catalogCompanyId || billingCompanyIds.length === 0) return map;

  const { data, error } = await supabase
    .from('article_families')
    .select('name, company_id, billing_company_id')
    .eq('company_id', catalogCompanyId);
  if (error) throw error;

  for (const row of data ?? []) {
    const family = row as { name: string; company_id: string; billing_company_id?: string | null };
    if (!familyMatchesBillingScope(family, catalogCompanyId, billingCompanyIds)) continue;
    map.set(family.name, resolveFamilyBillingCompanyId(family));
  }
  return map;
}

export function articleInBillingScope(
  article: {
    company_id: string;
    billing_company_id?: string | null;
    familia?: string | null;
  },
  catalogCompanyId: string,
  billingCompanyIds: string[],
  familyBillingByName: Map<string, string>,
): boolean {
  if (article.company_id !== catalogCompanyId || billingCompanyIds.length === 0) return false;

  const familia = article.familia?.trim();
  if (familia) {
    const familyBilling = familyBillingByName.get(familia);
    if (familyBilling === undefined) return false;
    return billingCompanyIds.includes(
      resolveArticleBillingCompanyId(article, familyBilling),
    );
  }

  const fallbackBilling = resolveFamilyBillingCompanyId({
    company_id: catalogCompanyId,
    billing_company_id: null,
  });
  return billingCompanyIds.includes(
    resolveArticleBillingCompanyId(article, fallbackBilling),
  );
}

export async function fetchReportFamilyArticles(
  catalogCompanyId: string,
  familia: string,
  billingCompanyIds: string[],
): Promise<ReportCatalogArticle[]> {
  if (!catalogCompanyId || billingCompanyIds.length === 0) return [];

  const { data: familyRow, error: famErr } = await supabase
    .from('article_families')
    .select('company_id, billing_company_id')
    .eq('company_id', catalogCompanyId)
    .eq('name', familia)
    .maybeSingle();
  if (famErr) throw famErr;
  if (
    !familyRow ||
    !familyMatchesBillingScope(
      familyRow as { company_id: string; billing_company_id?: string | null },
      catalogCompanyId,
      billingCompanyIds,
    )
  ) {
    return [];
  }

  const familyBillingId = resolveFamilyBillingCompanyId(
    familyRow as { company_id: string; billing_company_id?: string | null },
  );

  const { data, error } = await supabase
    .from('articles')
    .select('id, codigo, descripcion, company_id, billing_company_id')
    .eq('company_id', catalogCompanyId)
    .eq('familia', familia)
    .eq('estado', 'activo')
    .order('descripcion');
  if (error) throw error;

  return (data ?? [])
    .filter((a) => {
      const row = a as {
        company_id: string;
        billing_company_id?: string | null;
      };
      const billingId = resolveArticleBillingCompanyId(row, familyBillingId);
      return billingCompanyIds.includes(billingId);
    })
    .map((a) => ({
      id: a.id as string,
      codigo: a.codigo as string | null,
      descripcion: String(a.descripcion ?? ''),
    }));
}
